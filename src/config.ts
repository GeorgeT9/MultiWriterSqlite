import cfg from './config.json'
import path from "node:path"
import fs from "node:fs"


let { storeDir, watchDir, limitPartMb, countWorkers, onlyThisExts } = cfg

if (storeDir == undefined ) {
    console.error('Не задан обязательный конфигурационный параметр storeDir')
    process.exit(-1)    
}
if (watchDir == undefined ) {
    console.error('Не задан обязательный конфигурационный параметр watchDir')
    process.exit(-1)    
}
limitPartMb = limitPartMb == undefined || limitPartMb < 100 
    ? 100
    : limitPartMb

if (!path.isAbsolute(storeDir)) {
    storeDir = path.resolve(__dirname, "..", storeDir)
}
if (!path.isAbsolute(watchDir)) {
    watchDir = path.resolve(__dirname, "..", watchDir)
}

const sqlInitPartDbFilePath = path.resolve(__dirname, "..", "./sql/part.sql")
let sqlInit = null
try {
    sqlInit = fs.readFileSync(sqlInitPartDbFilePath, {encoding: 'utf-8'})
} catch (err) {
    throw(new Error("Ошибка чтения инфструкций инициализации part_db: " + (err as Error).message))
}

countWorkers = countWorkers || 4
onlyThisExts = onlyThisExts || [".txt", ".csv", ".doc", ".docx"]

export default {
    storeDir,
    watchDir,
    limitPartMb,
    sqlInit,
    countWorkers,
    onlyThisExts
}