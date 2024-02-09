import { opendir, stat } from "node:fs/promises"
import { extname, resolve } from "node:path"


/**
 * Создает итератор, который обходит все файлы из директории path и
 * возвращает файлы, чье время модификации больше afterMTimeMs и 
 * расширение принадлежит списку onlyThisExts
 */
export async function* genFileNamesFromDir(path: string, afterMTimeMs: number, onlyThisExts: string[] ) {
    const dir = await opendir(path, {recursive: true})
    const exts = new Set(onlyThisExts)
    for await (const f of dir ) {
        if (f.isFile()) {
            const fileFullName = resolve(f.path, f.name) 
            const { mtimeMs } = await stat(fileFullName)
            if (exts.has(extname(f.name)) && mtimeMs > afterMTimeMs) {
                yield fileFullName
            }
        }
    }
}

