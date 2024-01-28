import { IHandlerGroup } from "./handlers.types"



export class HandlerManager {
    private readonly _limitWorkers: number
    private readonly _handlerGroup: IHandlerGroup 

    constructor(limitWorkers: number, handlerGoup: IHandlerGroup) {
        if (limitWorkers < 1) {
            throw new Error('Количество воркеров должно быть не менее 1')
        }
        this._handlerGroup = handlerGoup
        this._limitWorkers = limitWorkers
    }



}