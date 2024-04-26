import { Dispatcher } from "./dispatcher/dispatcher"
import cfg from "./config"


async function main() {

    const dis = new Dispatcher(cfg.watchDir, cfg.storeDir, cfg.limitPartMb * 1024, cfg.sqlInit)
    console.time('app')
    await dis.process();
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

