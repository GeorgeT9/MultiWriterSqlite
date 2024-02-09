import cfg from "../config.json"
import { resolve } from "node:path"
import { readFileSync } from "node:fs"
import { Knex, knex } from "knex"
import { Database } from "better-sqlite3"



const MASTER_DB_NAME = 'master.db'
const PART_DB_PREFIX_NAME = 'part'
const CREATE_PART_DB_SQL = './part.sql'


const dbMaster = knex({
    client: 'better-sqlite3',
    connection: {
        filename: resolve(cfg.storeDir, MASTER_DB_NAME),
    },
    pool: {
        afterCreate: (conn: Database, done: (err: Error | null, conn: Database) => void) => {
            try {
                conn.pragma('foreign_keys=1')
                conn.pragma('journal_mode=WAL')
                done(null, conn)
            } catch (err) {
                console.error('Ошибка при подключении к master db: ', (err as Error).message)
                done(err as Error, conn)
            }
        }
    },
    acquireConnectionTimeout: 5000
})

/**
 * возвращает подключение к master базе
 */
export function getConnectionMasterDb() {
    return dbMaster
}


// кэш подключений к partsDb
const partConnections = new Map<number, Knex>

/**
 * возвращает подключения к part базам
 */
export function getConnectToPartDb(idPart: number): Knex {
    if (!partConnections.has(idPart)) {
        const conn = knex({
            client: 'better-sqlite3',
            connection: {
                filename: resolve(cfg.storeDir, `${PART_DB_PREFIX_NAME}_${idPart}.db`),
            },
            pool: {
                afterCreate: (conn: Database, done: (err: Error | null, conn: Database) => void) => {
                    try {
                        conn.pragma('foreign_keys=1')
                        conn.pragma('journal_mode=WAL')
                        const sqlInstructions = readFileSync(
                            resolve(__dirname, CREATE_PART_DB_SQL), 
                            {encoding: 'utf8'}
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
        partConnections.set(idPart, conn)
    }
    return partConnections.get(idPart)!
}


/**
 * Закрытие соединений master и parts баз данных
 */
export async function closeAllConnections() {
    return Promise.all(
        [dbMaster.destroy(), ...[...partConnections.values()].map(conn => conn.destroy())]
    )
}