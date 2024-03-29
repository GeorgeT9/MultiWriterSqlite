import { getTextExtractorFromFile } from "./files/textExtractors/textExtractor"
import { LinerStream } from "./files/linerStream"
import { HandlerTransformerStream } from "./handlers/handlerTransformerStream"
import { getFactoryFileWriter } from "./database/fileWriter"
import { resolve } from "node:path"
import { pipeline } from "node:stream/promises"
import { HandlerGroup } from "./handlers/handlerGroup"
import { Handler } from "./handlers/handler"
import { StoreType } from "./database/fileWriter"
import { managerConnectsDb } from "./database/sqlite/managerConnectsDb"



async function main() {
    const fileName = resolve(__dirname, "D:/udata/rus/beeline.csv")
    const hg = new HandlerGroup(new Handler('phone', /\d{11}/g))
    const writer = await getFactoryFileWriter(StoreType.Sqlite)(fileName)
    
    console.time('pipeline')
    await pipeline(
        getTextExtractorFromFile(fileName),
        new LinerStream(),
        new HandlerTransformerStream(hg),
        writer
    )
    console.timeEnd('pipeline')
}

main()
    .catch(err => {
        console.error(err)
    })
    .finally(() => {
        managerConnectsDb.closeAllConnect()
    })

process.once('uncaughtExceptionMonitor', (err) => {
    console.error('uncaughtException!!!!')
    managerConnectsDb.closeAllConnect()
})

