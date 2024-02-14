import { resolve } from "node:path"
import { Writable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { wordTextExtractor } from "./wordTextExtractor"


describe('WordTextExtractor', () => {
    
    const docFile = resolve("./src/__fixtures__/document.doc")  

    let out: string[]
    let writer: Writable

    beforeEach(() => {
        out = []
        writer = new Writable({
            write(chunk: Buffer, encoding, cb) {
                out.push(chunk.toString())
                cb()
            }
        })
        writer.setDefaultEncoding('utf-8')
    })

    it('should extract all text from doc-file', async () => {
        const reader = wordTextExtractor(docFile)
        await pipeline(reader, writer)
        expect(out.length).toBe(1)
    })

})