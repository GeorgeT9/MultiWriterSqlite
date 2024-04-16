import cfg from "./config"
import { genFileNamesFromDir } from "./files/dirReader"
import { getTextExtractorFromFile } from "./files/textExtractors/textExtractor"
import { LinerStream } from "./files/linerStream"
import {Commander, Command} from "./commander"
import { pipeline } from "node:stream/promises"
import { HandlerTransformerStream } from "./handlers/handlerTransformerStream"
import { handlersGroup } from "./handlersGroupInit"


const commander = new Commander(cfg.storeDir, cfg.limitPartKb)


async function main() {
    // время начала проверки
    const startCheckTime = Date.now()
    console.log('обход отслеживаемой директории ...')
    console.time('app')
    // обход наблюдаемой директории и запись/обновление информации о файлах
    for await (const fileInfo of genFileNamesFromDir(cfg.watchDir, 0, ['.txt', '.csv', '.doc', '.docx'])) {
        try {
            const command = await commander.exploreExistFile(fileInfo) 
            if (command !== Command.None) {
                if (command === Command.Update) {
                    // если файл изменился, то сначала стираем о нем всю информацию
                    await commander.deleteFileByName(fileInfo.fileName)
                    console.log(`${fileInfo.fileName}\t-`)
                }
                console.log(`${fileInfo.fileName}`)
                // обрабатываем и записываем файл потоком 
                await pipeline(
                    getTextExtractorFromFile(fileInfo.fileName),
                    new LinerStream(),
                    new HandlerTransformerStream(handlersGroup),
                    await commander.getWriter(fileInfo)
                    )
                console.log(`${fileInfo.fileName}\t+`)
            }
        } catch (err) {
            console.error(err)
            continue
        }
    }
    console.log('удаление файлов ...')
    // удаление информации о файлах, которые небыли обнаружены в последний обход наблюдаемой директории 
    await commander.clearDbOfDeletedFiles(startCheckTime)
    console.log('закрытие соединений ...')
    // выполнение всех необходимых операций над БД и закрытие их соединений
    await commander.closeAllConnections()
    console.timeEnd('app')
}


main()
    .catch(err => {
        console.error(err)
    })

process.once('uncaughtExceptionMonitor', (err) => {
    console.error('uncaughtException!!!!')
    console.error(err)
})

