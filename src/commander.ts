import { Writable } from "node:stream"
import { managerConnectsDb } from "./database/sqlite/managerConnectsDb"
import { FileDb, ItemDb, TextBoxDb } from "./database/sqlite/schema"
import { TextBox } from "./handlers/handlers.types"


export type FileInfo = {
    fileName: string,
    mTimeMs: number,
    sizeKb: number
}


const enum Command {
    Inser = 'Insert',
    Update = 'Update',
    None = 'None'
}



class Commander {

    _managerConnects = managerConnectsDb
    _connMaster = this._managerConnects.getConnectionMaster()

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
                mTimeMs: Date.now()
            }, '*')
            .where({
                fileName
            })
            .onConflict().ignore()
        return res.length ? res[0] : null
    }

    /** Удаление из БД информации о файле id;
     *  параметр id файла подразумевает, что данный файл существует в БД
     */
    private async clearFile(fileId: number) {
        const masterTrx = await this._connMaster.transaction()
        const { partId } = (await masterTrx<FileDb & {id: number}>('files')
            .del('partId')
            .where({
                id: fileId
            }))[0]
        const connPartDb = await this._managerConnects.getPartConnectionById(partId)
        const partTrx = await connPartDb.transaction()
        try {
            await partTrx<TextBoxDb>('text_boxs')
                .del()
                .where({
                    fileId 
                })
        } catch (err) {
            masterTrx.rollback()
            partTrx.rollback()
            throw new Error('Ошибка при удалении информации о файле id ' + fileId)
        }
        masterTrx.commit()
        partTrx.commit()
        return
    }

    /**
     */
    private async getFilesFromDelete(lastCheckTime: number) {
        return this._connMaster<FileDb & { id: number }>('files')
            .where('checkTimeMs', '<', lastCheckTime)
            .stream()
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
        console.log(fileInfo.fileName)


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


}

