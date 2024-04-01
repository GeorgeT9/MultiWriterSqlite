import cfg from "./config"
import { genFileNamesFromDir } from "./files/dirReader"
import { getTextExtractorFromFile } from "./files/textExtractors/textExtractor"
import { LinerStream } from "./files/linerStream"
import {Commander, Command} from "./commander"
import { pipeline } from "node:stream/promises"
import { HandlerGroup } from "./handlers/handlerGroup"
import { Handler } from "./handlers/handler"
import { HandlerTransformerStream } from "./handlers/handlerTransformerStream"


const commander = new Commander(cfg.storeDir, cfg.limitPartKb)


async function main() {
    // время начала проверки
    const startCheckTime = Date.now()
    // группа обработчиков 
    const hg = new HandlerGroup(
        new Handler('number', /\d{3}-\d{2}-\d{4}/g)
    )
    // обход наблюдаемой директории и запись/обновление информации о файлах
    for await (const fileInfo of genFileNamesFromDir(cfg.watchDir, 0, ['.txt', '.csv', '.doc', '.docx'])) {
        console.log(fileInfo.fileName)
        try {
            const command = await commander.exploreExistFile(fileInfo) 
            if (command !== Command.None) {
                if (command === Command.Update) {
                    // если файл изменился, то сначала стираем о нем всю информацию
                    await commander.deleteFile(fileInfo.fileName)
                }
                // обрабатываем и записываем файл потоком 
                await pipeline(
                    getTextExtractorFromFile(fileInfo.fileName),
                    new LinerStream(),
                    new HandlerTransformerStream(hg),
                    await commander.getWriter(fileInfo)
                )
            }
        } catch (err) {
            console.error(err)
            continue
        }
    }
    // удаление информации о файлах 
    await commander.clearDbOfDeletedFiles(startCheckTime)
    // выполнение всех необходимых операций над БД и закрытие их соединений
    await commander.closeAllConnections()
}


main()
    .catch(err => {
        console.error(err)
    })

process.once('uncaughtExceptionMonitor', (err) => {
    console.error('uncaughtException!!!!')
    console.error(err)
})

