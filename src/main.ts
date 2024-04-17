import { PartConnect } from "./database/partConnect"
import { handlersGroup } from "./handlersGroupInit"
import { genFileNamesFromDir } from "./files/dirReader"
import cfg from "./config"


async function main() {
    const part = new PartConnect(9999)
    // for await (const fileInfo of genFileNamesFromDir(cfg.watchDir, 0, ['.txt', '.doc', '.docx', '.csv'])) {
    //     console.time('file')
    //     console.log(fileInfo.fileName)
    //     await part.processFile(fileInfo, handlersGroup)
    //     console.timeEnd('file')
    // }    
    console.log(await part.getFilesSizeKb())
}


main()
    .catch(err => {
        console.error(err)
    })

process.once('uncaughtExceptionMonitor', (err) => {
    console.error('uncaughtException!!!!')
    console.error(err)
})

