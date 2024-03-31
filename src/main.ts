import { getTextExtractorFromFile } from "./files/textExtractors/textExtractor"
import { LinerStream } from "./files/linerStream"
import { HandlerTransformerStream } from "./handlers/handlerTransformerStream"
import { resolve } from "node:path"
import { pipeline } from "node:stream/promises"
import { HandlerGroup } from "./handlers/handlerGroup"
import { Handler } from "./handlers/handler"
import { managerConnectsDb } from "./database/sqlite/managerConnectsDb"



async function main() {
    const fileName = resolve(__dirname, "D:/udata/rus/beeline.csv")
    
}

main()
    .catch(err => {
        console.error(err)
    })
    .finally(() => {
        managerConnectsDb.closeAllConnect(true)
            .then(() => console.log('Соединения с БД закрыты'))
    })

process.once('uncaughtExceptionMonitor', (err) => {
    console.error('uncaughtException!!!!')
    managerConnectsDb.closeAllConnect()
})

