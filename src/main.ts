import { getTextExtractorFromFile } from "./files/textExtractors/textExtractor"
import { LinerStream } from "./files/linerStream"
import { HandlerTransformerStream } from "./handlers/handlerTransformerStream"
import { getFactoryFileWriter } from "./database/fileWriter"
import { resolve } from "node:path"
import { pipeline } from "node:stream/promises"
import { HandlerGroup } from "./handlers/handlerGroup"
import { Handler } from "./handlers/handler"
import { StoreType } from "./database/fileWriter"
import { closeAllConnections } from "./database/sqlite/connect"
import { Writable } from "node:stream"
import { getConnectionMasterDb } from "./database/sqlite/connect"
import { FileDb } from "./database/sqlite/schema"



async function main() {
    const fileName = resolve(__dirname, "D:/udata/rus/beeline.csv")
    // 149-79-8816
    const hg = new HandlerGroup(new Handler('phone', /\d{3}-\d{2}-\d{4}/g, (str) => str.replace('-', '')))
    const writer = await getFactoryFileWriter(StoreType.Sqlite)(fileName)

    await pipeline(
        getTextExtractorFromFile(fileName),
        new LinerStream(),
        new HandlerTransformerStream(hg),
        writer
    )
}

main()
    .catch(err => {
        console.error(err)
    })
    .finally(() => {
        closeAllConnections()
    })

process.once('uncaughtExceptionMonitor', (err) => {
    console.error('uncaughtException!!!!')
    closeAllConnections()
})

