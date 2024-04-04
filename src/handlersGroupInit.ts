import { Handler } from "./handlers/handler"
import { HandlerGroup } from "./handlers/handlerGroup"



// группа обработчиков 
export const handlersGroup = new HandlerGroup(
    new Handler('phone', new RegExp('\\+?\\d+[(-]?\\d+[)-]?(?:-?\\d+)*', 'g'), clearNumberPhone),
    new Handler('email', new RegExp('[\\w\\-\\.\\d]+@{1}\\w+(?:\\.{1}\\w{2,5})+', 'g'))
)


function clearNumberPhone(numberRaw: string) {
    const fixEight = true
    function changeEight(number: string) {
        if (number[0] === '8' && number.length === 11) {
            number = '7' + number.slice(1)
        }
        return number
    }

    let clearNumber = numberRaw.replace(/\D+/g, "")
    if (clearNumber.length < 11 || clearNumber.length > 12) {
        return null
    }
    return fixEight ? changeEight(clearNumber) : clearNumber
}
