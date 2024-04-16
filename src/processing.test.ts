import { resolve } from "node:path"
import { genFileNamesFromDir } from "./files/dirReader"
import { LinerStream } from "./files/linerStream"
import { getTextExtractorFromFile } from "./files/textExtractors/textExtractor"
import { Handler } from "./handlers/handler"
import { HandlerGroup } from "./handlers/handlerGroup"
import { HandlerTransformerStream } from "./handlers/handlerTransformerStream"
import { Writable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { TextBox} from "./handlers/handlers.types"



describe('general test for processing chain streams', () => {
    
    const dirName = resolve('__fixtures__')
    const h1 = new Handler('numbers', /\b\d{3}-\d{2}-\d{4}\b/g, (raw) => raw.replace('-', ''))    
    const h2 = new Handler('date', /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g)    
    const hg = new HandlerGroup(h1, h2)
    
    let out: TextBox[] = []

    it('shoud correct process files', async () => {
        for await (const fileInfo of genFileNamesFromDir(dirName, 0, ['.txt', '.doc'])) {
            const textExtractor = getTextExtractorFromFile(fileInfo.fileName)
            const liner = new LinerStream()
            const handler = new HandlerTransformerStream(hg)
            const writer = new Writable({
                write(chunk: TextBox, encoding, cb) {
                    out.push(chunk)
                    cb()
                },
                objectMode: true
            })
            await pipeline(textExtractor, liner, handler, writer)
        }
        expect(out.length).toBeGreaterThan(1)
    })
    


})
