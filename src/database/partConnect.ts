import { Knex, knex } from "knex"
import { Database } from "better-sqlite3"
import path from "node:path";
import { Writable } from "node:stream"
import { pipeline } from "node:stream/promises"
import fs from "node:fs"
import cfg from "../config"
import { FileDb, ItemDb, TextBoxDb } from "./schema";
import { HandlerGroup } from "../handlers/handlerGroup";
import { TextBox } from "../handlers/handlers.types"
import { FileInfo } from "../files/dirReader"
import { getTextExtractorFromFile } from "../files/textExtractors/textExtractor"
import { LinerStream } from "../files/linerStream"
import { HandlerTransformerStream } from "../handlers/handlerTransformerStream"



export class PartConnect {

    private readonly _storeDir = cfg.storeDir
    private readonly _watchDir = cfg.watchDir
    private readonly _sqlInit = cfg.sqlInit
    private readonly _partId: number
    private readonly _conn: Knex

    constructor(partId: number) {
        this._partId = partId
        this._conn = this.makeConnection()
    }

    // создает подключение в зависимости от того уже существует part_db или нет
    private makeConnection() {
        let partDbExists = this.isFilePartDbExist()
        // объект конфигурации соединения
        let config: Knex.Config["pool"] = {
            afterCreate: (conn: Database, done: Function) => {
                try {
                    if (!partDbExists) {
                        console.debug("cоздание новой part_db")
                        // создание структуры для несуществующих part_db
                        conn.exec(this._sqlInit)
                    } else {
                        console.debug("подключение к существующей part_db")
                        // удаление индекса для существующей part_db
                        conn.exec("DROP INDEX IF EXISTS idx_items")
                    }
                    conn.pragma("foreign_keys = 1")
                    conn.pragma("cache_size = -10000")
                    conn.pragma("locking_mode = EXCLUSIVE")
                    conn.pragma("journal_mode = PERSIST")
                    conn.pragma("synchronous = OFF")
                    done(null, conn)
                } catch (err) {
                    done(err as Error, null)
                }
            },

        }
        return knex({
            client: "better-sqlite3",
            connection: {
                filename: this.fullFileName,
            },
            pool: config,
            useNullAsDefault: true
        })
    }

    // проверка наличия файла part_db
    private isFilePartDbExist() {
        try {
            fs.accessSync(this.fullFileName, fs.constants.F_OK)
            return true
        } catch {
            return false
        }
    }

    /** id part_db */
    get partId() {
        return this._partId
    }

    /** полное имя файла part_db */
    get fullFileName() {
        return path.resolve(this._storeDir, `part_${this._partId}.db`)
    }

    /** запрос информации о файле по его имени */
    async getFileByName(fileName: string) {
        return this._conn<FileDb>('files')
            .where({
                file_name: fileName
            })
    }

    /** Запрос информации по всем файлам */
    async getAllFiles() {
        return this._conn<FileDb>("files")
    }

    /** обработать файл и записать полученные данные в part_db */
    async processFile(file_info: FileInfo, hg: HandlerGroup) {
        const trx = await this._conn.transaction()
        try {
            // запись информации о файле
            const fileId = (await trx<FileDb>("files").insert({
                file_name: file_info.fileName,
                size_kb: file_info.sizeKb,
                time_modified: file_info.mTimeMs,
                time_last_check: Date.now()
            }, 'id'))[0]['id']
            // pipeline по обработке и запись файла 
            const writer = new FilePartWriter(trx, fileId)
            await pipeline(
                getTextExtractorFromFile(path.resolve(this._watchDir, file_info.fileName)),
                new LinerStream(),
                new HandlerTransformerStream(hg),
                writer
            )
            trx.commit()
        } catch (err) {
            trx.rollback(err)
            throw new Error(`Ошибка при записи файла ${file_info.fileName}`, { cause: err })
        }
    }

    // вернет сумму размеров файлов записанных в 
    async getFilesSizeKb() {
        const res = (await (this._conn<FileDb>("files")
            .sum('size_kb', {as: "sum"}))
        )[0]["sum"]
        return res
    }

    /** закрытие соединения с part_db с выполнением индексации */
    async close(vacuum: boolean = false) {
        // строим индекс над значениями items
        await this._conn.schema.table("items", t => {
            t.index('value', "idx_items")
        })
        if (vacuum) {
            await this._conn.raw("VACUUM")
        }
        return this._conn.destroy()
    }

}



/** 
 * Writable для записи отдельного файла;  
 * при записи очередной порции данных эмитится событие
 * writed с передачей в параметре количества записанных объектов
 * */
class FilePartWriter extends Writable {

    private readonly _conn: Knex
    private readonly _fileId: number

    constructor(conn: Knex, fileId: number) {
        super({
            objectMode: true,
            highWaterMark: 5000
        })
        this._conn = conn
        this._fileId = fileId
    }

    _writev(chunks: { chunk: TextBox, encoding: BufferEncoding }[], callback: (error?: Error | null | undefined) => void): void {
        Promise.all(chunks.map(({ chunk: textBox }) => this.writeTextBox(textBox, this._fileId)))
            .then(_ => {
                this.emit("writed", chunks.length)
                callback(null)
            })
            .catch(err => callback(err))
    }

    // запись textBox вместе с его items
    async writeTextBox(textBox: TextBox, fileId: number) {
        // записываем textBox и получаем его id
        const textBoxId = (await this._conn<TextBoxDb>('text_boxs')
            .insert({
                file_id: fileId,
                number_block: textBox.line[0],
                text: textBox.line[1]
            })
            .returning('id'))[0]['id']
        // записываем items, соответствующие textBox
        if (textBox.items) {
            const items: Omit<ItemDb, 'id'>[] = [...textBox.items.values()]
                .flatMap(items => items)
                .map(item => ({
                    value: item.value,
                    start: item.range[0],
                    end: item.range[1],
                    text_box_id: textBoxId
                }))
            await this._conn<ItemDb>('items')
                .insert(items)
        }
    }

}