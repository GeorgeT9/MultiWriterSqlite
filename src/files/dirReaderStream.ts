import { opendir } from "node:fs/promises"
import { extname, resolve } from "node:path"
import { Readable } from "node:stream"


export async function* genFileNamesFromDir(path: string, onlyThisExts?: string[] ) {
    const dir = await opendir(path, {recursive: true})
    const exts = onlyThisExts?.length ? 
        new Set(onlyThisExts) : 
        undefined
    for await (const f of dir ) {
        if (f.isFile()) {
            if (exts === undefined) {
                yield resolve(f.path, f.name)
            } else if (exts.has(extname(f.name))) {
                yield resolve(f.path, f.name)
            }
        }
    }
}


/**
 * Readable stream, рекурсивно обходящит все файлы, начиная с директории path
 * и возвращает полные пути к файлам, с расширением
 * из списка onlyThisExts (если не задано или задан пустой массив,
 * то возвращает все имена файлов)
 */
export const dirReaderStream = (path: string, onlyThisExts?: string[]) => {
    return Readable.from(genFileNamesFromDir(path, onlyThisExts))
}