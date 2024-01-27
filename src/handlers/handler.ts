
/**
 * Выполняет нормализацию и валидацию значения value, 
 * если вернет null - значение отбрасывается 
 * */
type PostFunc = (str: string) => string | null

type Item = {
    value: string,
    range: [number, number]
}


export class Handler {
    private readonly _name: string
    private readonly _regexp: RegExp
    private readonly _postFunc?: PostFunc
    
    constructor(name: string, regexp: RegExp, postFunc?: PostFunc) {
        this._name = name
        this._regexp = regexp
        this._postFunc = postFunc
    }

    get name() {
        return this._name
    }

    process(text: string): Item[] {
        const out: Item[] = []
        for( const match of text.matchAll(this._regexp)) {
            const value = this._postFunc ? this._postFunc(match[0]) : match[0] 
            if (!value) {
                continue
            }            
            out.push({
                value,
                range: [match.index!, match.index! + match[0].length]
            })    
        }
        return out
    }
}