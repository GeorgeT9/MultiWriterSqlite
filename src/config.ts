import cfg from './config.json'
import path from "node:path"



let { storeDir, watchDir, limitPartKb } = cfg

if (storeDir == undefined ) {
    console.error('Не задан обязательный конфигурационный параметр storeDir')
    process.exit(-1)    
}
if (watchDir == undefined ) {
    console.error('Не задан обязательный конфигурационный параметр watchDir')
    process.exit(-1)    
}
limitPartKb = limitPartKb == undefined || limitPartKb < 100_000 
    ? 100_000
    : limitPartKb

if (!path.isAbsolute(storeDir)) {
    storeDir = path.resolve(__dirname, storeDir)
}
if (!path.isAbsolute(watchDir)) {
    watchDir = path.resolve(__dirname, watchDir)
}


export default {
    storeDir,
    watchDir,
    limitPartKb
}