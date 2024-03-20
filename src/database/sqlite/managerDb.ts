import cfg from "../../config.json"
import { FileDb } from "./schema"
import { resolve } from "node:path"
import { Knex, knex } from "knex"
import { Database } from "better-sqlite3"
import { readFileSync } from "node:fs"
import { PartDb } from "./schema"




class ManagerDb {

    private readonly _connMaster: Knex                          // соединенение с мастер базой
    private readonly _connPartMap: Map<number, Knex>            // мапа соединений с part базами, которые используются в данный момент
    private readonly MASTER_DB_NAME = 'master.db'               // имя мастер базы данных
    private readonly PART_DB_PREFIX_NAME = 'part'               // префикс имени баз данных part
    private readonly INITIAL_PART_DB_SQL_FILE = 'part.sql'      // имя файла с инструкциями для создания part db
    private readonly PART_SIZE_LIMIT_kB = 100 * 1024   // значение, при привышении которого данная part db больше не используется

    constructor() {
        this._connMaster = this.getConnectionMaster()
        this._connPartMap = new Map()
    }

    /** создание подключения к мастер базе */
    getConnectionMaster() {
        return knex({
            client: 'better-sqlite3',
            connection: {
                filename: resolve(cfg.storeDir, this.MASTER_DB_NAME),
            },
            pool: {
                afterCreate: (conn: Database, done: (err: Error | null, conn: Database) => void) => {
                    try {
                        conn.pragma('foreign_keys=1')
                        done(null, conn)
                    } catch (err) {
                        console.error('Ошибка при подключении к master db: ', (err as Error).message)
                        done(err as Error, conn)
                    }
                }
            },
            useNullAsDefault: true,
            acquireConnectionTimeout: 5000
        })

    }
    
    /** Получить (при необходимость создать новое) подключение к partDb. Вернет номер подключения и само подслючение */
    async getPartConnect() {
        const idPart = await this.getPartId()
        if (!this._connPartMap.has(idPart)) {
            const conn = knex({
                client: 'better-sqlite3',
                connection: {
                    filename: resolve(cfg.storeDir, `${this.PART_DB_PREFIX_NAME}_${idPart}.db`),
                },
                useNullAsDefault: true,
                pool: {
                    afterCreate: (conn: Database, done: (err: Error | null, conn: Database) => void) => {
                        try {
                            conn.pragma('foreign_keys=1')
                            const sqlInstructions = readFileSync(
                                resolve(cfg.storeDir, this.INITIAL_PART_DB_SQL_FILE),
                                { encoding: 'utf8' }
                            )
                            conn.exec(sqlInstructions)
                            done(null, conn)
                        } catch (err) {
                            console.error('Ошибка при подключении к part db: ', (err as Error).message)
                            done(err as Error, conn)
                        }
                    }
                }
            })
            this._connPartMap.set(idPart, conn)
        }
        return [idPart, this._connPartMap.get(idPart)!] as const
    }

    /** Получить id partDb для записи */
    private async getPartId() {
        const partsSize = await this.getPartsSize()
        console.debug(partsSize)
        // выбираем только partId, которые удоветворяют лимиту по размеру
        const partsForUsing = partsSize
            .filter(part => part.sizeKb < this.PART_SIZE_LIMIT_kB)
        if (partsForUsing.length > 0) {
            return partsForUsing[0]['partId']
        } else {
            return await this.newPart()
        }
    }

    /** Получить размеры данных, записанные в каждой part базе, отсортированные от меньшего к большему*/
    private async getPartsSize() {
        const partsSize = await this._connMaster<FileDb>('files')
            .select('partId', 'sizeKb')
            .sum('sizeKb', { as: 'sizeKb' })
            .groupBy('partId')
            .orderBy('sizeKb', 'asc')
        return partsSize
    }

    /** Регистрирует новую запись для partDb и возвращает его id */
    private async newPart(): Promise<number> {
        const res = await this._connMaster<PartDb>('parts')
            .insert({ created: new Date() }, 'id')
        return res[0]['id']
    }
}



export const managerDb = new ManagerDb()

