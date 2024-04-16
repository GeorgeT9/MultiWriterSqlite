import { Knex, knex } from "knex"
import { Database } from "better-sqlite3"
import path from "node:path";
import { readFile } from "node:fs/promises"
import fs from "node:fs"
import cfg from "../config"


class PartConnect {

    private readonly _storeDir = cfg.storeDir
    private readonly _watchDir = cfg.watchDir
    private readonly _limitSizeMb = cfg.limitPartMb
    private readonly _sqlInit = cfg.sqlInit
    private readonly _partId: number
    private readonly _conn: Knex

    constructor(partId: number) {
        this._partId = partId
        this._conn = this.makeConnection(partId)
    }

    // создает подключение в зависимости от того уже существует part_db или нет
    private makeConnection(partId: number) {
        let partDbExists: boolean
        
        // проверка наличия part_db
        try {
            fs.accessSync(this.fullFileName, fs.constants.F_OK)
            partDbExists = true
        } catch (err) {
            partDbExists = false
        }
        // объект конфигурации соединения
        let config: Knex.Config["pool"] = {
                afterCreate: async (conn: Database, done: Function) => {
                    try {
                        if (!partDbExists) {
                            // создание структуры для несуществующих part_db
                            conn.exec(this._sqlInit)
                        } else {
                            // удаление индекса для существующей part_db
                            conn.exec("DROP INDEX IF EXISTS index_item")
                        }
                        conn.pragma("foreign_keys = 1")
                        conn.pragma("pragma cache_size = -10000")
                        conn.pragma("pragma locking_mode = EXCLUSIVE")
                        done(null, conn)
                    } catch (err) {
                        done(err as Error, null)
                    }
                }
            }

        return knex({
            client: "better-sqlite3",
            connection: {
                filename: this.fullFileName,
            },
            pool: config
        })
    }


    get fullFileName() {
        return path.resolve(this._storeDir, `part_${this._partId}.db`)
    }


}