import { getConnectToPartDb, getConnectionMasterDb } from "./connect"
import { Writable } from "node:stream"
import { TextBox } from "../../handlers/handlers.types"
import { FactoryFileWriter } from "../fileWriter"
import { TextBoxDb, ItemDb, FileDb } from "./schema"
import { stat } from "node:fs/promises"


/**
 * Создает writable stream object для записи потока по файлу,
 * имя которого передано в параметре
 */
export const getSqliteWriter: FactoryFileWriter = async (fileName: string) => {

    const master_conn = getConnectionMasterDb()
    const partId = 0 //TODO: определить функцию получения partId
    const part_conn = getConnectToPartDb(partId)

    const extractItemValues = (tb: TextBox) => {
        if (tb.items?.size) {
            return [...tb.items?.entries()].flatMap(([_, items]) => items)
        }
        return []
    }
    // получаем статистику по файлу 
    const fileStat = await stat(fileName)
    // объект-тарнзакция для записи информации о файле 
    // (будет закрыта только после обработки всего содержимого файла)
    const trxMaster = await master_conn.transaction()
    // вставляем информацию по файлу и получаем его id 
    const fileId: number = (await master_conn<FileDb>('files')
        .transacting(trxMaster)
        .insert({
            fileName,
            mTimeMs: fileStat.mtimeMs,
            partId,
            sizeKb: Math.round(fileStat.size / 1024)
        }, 'id')
    )[0].id

    // объект-транзакция для записи textBoxs и items
    const trxPart = await part_conn.transaction()

    const writer = new Writable({
        objectMode: true,
        highWaterMark: 1000,
        writev(chunks: { chunk: TextBox }[], callback: (error: Error | null) => void) {
            // добавляем все textBoxs  получаем их id
            Promise.all(chunks.map(({ chunk }) => part_conn<TextBoxDb>('text_boxs')
                .transacting(trxPart)
                .insert({
                    fileId: fileId,
                    numberLine: chunk.line[0],
                    text: chunk.line[1]
                }, 'id')
            )).then(textBoxIdArray => {
                // вставляем items для каждого textBox
                textBoxIdArray
                    .flat()
                    // каждому textBox id сопоставляется в кортеже textBox
                    .map(({ id }, i) => [id, chunks[i].chunk] as const)
                    // отбрасываем кортежи, где textBox не содержит items
                    .filter(([_, chunk]) => chunk.items?.size)
                    .forEach(([id, chunk]) => {
                        const items = extractItemValues(chunk)
                        console.log(items)
                        part_conn<ItemDb>('values')
                            .transacting(trxPart)
                            .insert(items.map(item => ({
                                value: item.value,
                                position: JSON.stringify(item.range),
                                textBoxId: id
                            })))
                    })
            })
                .then(() => callback(null))
                .catch(err => callback(err))
        },
        final(callback) {
            trxPart.commit()
                .then(() => {
                    trxMaster.commit()
                        .then(() => {
                            callback(null)
                            console.log(`${fileName} - ok`)
                        })
                })

        },
    })

    writer.once('error', (err) => {
        console.error(err)
        trxMaster.rollback(err)
        trxPart.rollback(err)
    })

    return writer
}

