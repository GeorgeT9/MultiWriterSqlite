import { ManagerConnectsDb } from "./database/sqlite/managerConnectsDb"
import { Writable } from "node:stream"
import { FileDb, ItemDb, TextBoxDb } from "./database/sqlite/schema"
import { TextBox } from "./handlers/handlers.types"
import { EOL } from "node:os"
import { Knex } from "knex"


export type FileInfo = {
    fileName: string,
    mTimeMs: number,
    sizeKb: number
}


export const enum Command {
    Inser = 'Insert',
    Update = 'Update',
    None = 'None'
}



export class Commander {

    _managerConnects: ManagerConnectsDb
    _connMaster: Knex 

    constructor(storeDir: string, limitPartDb: number) {
        this._managerConnects = new ManagerConnectsDb(storeDir, limitPartDb)
        this._connMaster = this._managerConnects.getConnectionMaster()
    }

    // действия, необходимые выполнить для существующего в директории файла
    async exploreExistFile(fileInfo: FileInfo): Promise<Command> {
        const fileFromDb = await this.getInfoFileFromDb(fileInfo.fileName)
        if (fileFromDb == null) {
            // новый файл
            return Command.Inser
        }
        if (fileInfo.mTimeMs > fileFromDb.mTimeMs) {
            // файл изменился
            Command.Update
        }
        // Файл не изменился
        return Command.None
    }

    /** 
     * Запрос информации о файле с одновременным обновлением поля checkTileMs в БД
     * попытка update несуществующего файла игнорируется
     * возвращается обновленное состояние записи о файле или null, если записи о файле нет
     */
    private async getInfoFileFromDb(fileName: string) {
        const res = await this._connMaster<FileDb>('files')
            .update({
                checkTimeMs: Date.now()
            }, '*')
            .where({
                fileName
            })
            .onConflict().ignore()
        return res.length > 0 ? res[0] : null
    }

    /**
     * Очистка БД от файлов, которые были удалены из файловой системы;
     * @param lastCheckTime время последней проверки БД в мс
     */
    async clearDbOfDeletedFiles(lastCheckTime: number) {
        const tasksClear = []
        for await (const file of await this.getFilesFromDelete(lastCheckTime)) {
            tasksClear.push(this.clearFile(file.id))
        }
        const res = await Promise.allSettled(tasksClear)
        const errorMessages: string[] = []
        for (const resCleared of res) {
            if (resCleared.status == 'rejected') {
                errorMessages.push((resCleared.reason as Error).message)
            }
        }
        if (errorMessages.length > 0) {
            console.error(errorMessages.join(EOL))
        }
    }

    /**
     * Получить асинхронный итератор для обхода файлов в БД,
     * по которым не выполнялась проверка после времени lastCheckTime 
     */
    private async getFilesFromDelete(lastCheckTime: number) {
        return this._connMaster<FileDb & { id: number }>('files')
            .where('checkTimeMs', '<', lastCheckTime)
            .stream()
    }

    /** Удаление из БД информации о файле id;
     *  параметр id файла подразумевает, что данный файл существует в БД
     */
    private async clearFile(fileId: number) {
        const masterTrx = await this._connMaster.transaction()
        const partId = (await masterTrx<FileDb & {id: number}>('files')
            .select('partId')
            .where({
                id: fileId
            })
            )[0].partId
        const connPartDb = await this._managerConnects.getPartConnectionById(partId)
        const partTrx = await connPartDb.transaction()
        try {
            await masterTrx<FileDb & {id: number}>('files')
                .where({
                    id: fileId
                })
                .del()
            await partTrx<TextBoxDb>('text_boxs')
                .where({
                    fileId 
                })
                .del()
        } catch (err) {
            masterTrx.rollback()
            partTrx.rollback()
            throw new Error('Ошибка при удалении информации о файле id ' + fileId)
        }
        masterTrx.commit()
        partTrx.commit()
        return
    }

    /** Удалит информацию о файле из БД по его имени */
    async deleteFile(fileName: string) {
        const res = await this._connMaster<FileDb & {id: number}>('files')
            .where({
                fileName
            })
            .returning('id')
        const fileId = res[0]?.id
        if (fileId == undefined) {
            throw new Error("Попытка удалить несуществующий файл " + fileName)
        }
        return this.clearFile(fileId)
    }

    /**
     * Вернет writable stream для записи переданного файла
     */
    async getWriter(fileInfo: FileInfo) {
        const [partId, partConnect] = await this._managerConnects.getPartConnect()
        // транзакции в обе БД коммитятся и отклоняются синхронно
        const masterTrx = await this._connMaster.transaction()
        const partTrx = await partConnect.transaction()
        // записываем файл в БД и получаем его id
        const fileId: number = (await masterTrx<FileDb>('files')
            .insert({
                ...fileInfo,
                partId,
                checkTimeMs: Date.now()
            }, 'id'))[0].id


        class SqliteWriter extends Writable {

            private readonly _buffer: TextBox[]
            private readonly _bufferLimit

            constructor(highWaterMark: number = 10_000) {
                super({ highWaterMark, objectMode: true })
                // буфер для промежуточного накопления данных
                this._buffer = []
                this._bufferLimit = highWaterMark
            }

            private extractItemValues(tb: TextBox) {
                if (tb.items?.size) {
                    return [...tb.items?.entries()].flatMap(([_, items]) => items)
                }
                return []
            }

            /** Записываем в БД все данные, накопленные в буфере */
            private async flushBuffer() {
                // записываем textBoxs, получаем их id
                const idTextBoxs = await Promise.all(this._buffer.map(tb => {
                    return partTrx<TextBoxDb>('text_boxs')
                        .insert({
                            fileId: fileId,
                            numberLine: tb.line[0],
                            text: tb.line[1]
                        }, 'id')
                }))
                // записываем items
                await Promise.all(
                    idTextBoxs
                        .flat()
                        .map((idTb, i) => [idTb, this._buffer[i]] as const)
                        .filter(([_, tb]) => tb.items?.size)
                        .map(([idTb, tb]) => {
                            const items = this.extractItemValues(tb)
                            return partTrx<ItemDb>('items')
                                .insert(items.map(item => ({
                                    value: item.value,
                                    position: JSON.stringify(item.range),
                                    textBoxId: idTb.id
                                })))
                        })
                )
                // сбрасываем буфур записей
                this._buffer.length = 0
            }

            _write(chunk: TextBox, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
                this._buffer.push(chunk)
                if (this._buffer.length >= this._bufferLimit) {
                    this.flushBuffer()
                        .then(() => callback(null))
                        .catch(err => callback(err))
                } else {
                    callback()
                }

            }

            _final(callback: (error?: Error | null) => void): void {
                this.flushBuffer()
                    .then(() => {
                        masterTrx.commit()
                            .then(() => partTrx.commit())
                            .then(() => callback())
                    })
                    .catch(err => callback(err))
            }
        }

        return new SqliteWriter()
            .once('error', (err) => {
                masterTrx.rollback()
                partTrx.rollback()
                console.error(`${fileInfo.fileName} - error : ${err.message}`)
            })
            .once('finish', () => {
                console.log(fileInfo.fileName + ' - ok')
            })
    }

    /** Закрыть все соединения, перед этим выполнив индексацию и вакуум */
    async closeAllConnections() {
        return this._managerConnects.closeAllConnect()
    }
}
