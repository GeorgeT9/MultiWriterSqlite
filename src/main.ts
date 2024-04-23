import { PartConnect } from "./database/partConnect"
import { handlersGroup } from "./handlersGroupInit"
import { genFileNamesFromDir } from "./files/dirReader"
import cfg from "./config"


async function main() {
}


main()
    .catch(err => {
        console.error(err)
    })

process.once('uncaughtExceptionMonitor', (err) => {
    console.error('uncaughtException!!!!')
    console.error(err)
})

