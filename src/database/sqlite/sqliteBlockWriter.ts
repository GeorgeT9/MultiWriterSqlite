import { Writable, WritableOptions } from "node:stream"
import { FactoryFileWriter } from "../fileWriter"
import { TextBox } from "../../handlers/handlers.types"
import { FileDb, ItemDb, TextBoxDb } from "./schema"
import { stat } from "node:fs/promises"
import { managerDb } from "./managerDb"



export const getSqliteWriter: FactoryFileWriter = async (fileName: string) => {

    const masterConnect = managerDb.getConnectionMaster()
    const [partId, partConnect] = await managerDb.getPartConnect()
    // транзакции в обе БД коммитятся и отклоняются синхронно
    const masterTrx = await masterConnect.transaction()
    const partTrx = await partConnect.transaction()
    // статистика по файлу
    const fileStat = await stat(fileName)
    // записываем файл в БД и получаем его id
    const fileId: number = (await masterTrx<FileDb>('files')
        .insert({
            fileName,
            mTimeMs: fileStat.mtimeMs,
            partId,
            sizeKb: Math.round(fileStat.size / 1024)
        }, 'id'))[0].id
    console.log(fileName, ' id: ', fileId)


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

        private async flushBuffer() {
            // записываем textBoxs
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
                        partTrx<ItemDb>('values')
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
            console.error(`${fileName} - error : ${err.message}`)
        })
        .once('finish', () => {
            console.log(fileName + ' - ok')
        })

}