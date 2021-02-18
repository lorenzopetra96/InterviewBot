import { ActivityHandler, MessageFactory , ActivityTypes, ActionTypes, CardFactory } from "botbuilder";
import { InputHints, StatePropertyAccessor, TurnContext } from 'botbuilder';
import { LuisRecognizer } from 'botbuilder-ai';
import {
    ComponentDialog,
    DialogSet,
    DialogState,
    DialogTurnResult,
    DialogTurnStatus,
    TextPrompt,
    WaterfallDialog,
    WaterfallStepContext
} from 'botbuilder-dialogs';
import { InterviewBotRecognizer } from "../cognitiveModels/InterviewBotRecognizer";


const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const TEXT_PROMPT = 'TEXT_PROMPT';
const SPOSITION_DIALOG = 'SPOSITION_DIALOG';
var conn = require('./../../connectionpool.js');

export class SPositionDialog extends ComponentDialog {
    private datiUtente;
    private luisRecognizer: InterviewBotRecognizer;
    private buttons = [];
    private texts = [];
    constructor(luisRecognizer: InterviewBotRecognizer){
        super(SPOSITION_DIALOG);

        this.luisRecognizer = luisRecognizer;
        //The primary goal of PromptDialog is an easy way to get input from the user and validate the data
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.welcomeStep.bind(this),
                this.choiceStep.bind(this),
                this.openedpositionsStep(this),
                this.finalStep.bind(this)
            ]));

        this.initialDialogId = WATERFALL_DIALOG;

    }

    
     /**
     * The run method handles the incoming activity (in the form of a DialogContext) and passes it through the dialog system.
     * If no dialog is active, it will start the default dialog.
     * @param {TurnContext} context
     */
    public async run(context, accessor) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this);

        const dialogContext = await dialogSet.createContext(context);
        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {
            await dialogContext.beginDialog(this.id);
        }
    }

    async welcomeStep(step){

        this.datiUtente = step._info.options;

        var finalquery = 'SELECT * FROM "Posizioni_Aperte";';
        await conn.query(finalquery).then((result) => {

            result.recordset.forEach(elem => {
               this.buttons.push({
                   type: ActionTypes.ImBack,
                   title: elem.titolo,
                   value: elem.titolo
               });
           });
        });

        return await step.next(step);

    }

    async choiceStep(step){

        var card = CardFactory.heroCard(
            '',
            undefined,
            JSON.parse(JSON.stringify(this.buttons))
        );

        return await step.prompt(TEXT_PROMPT, {
            prompt: this.datiUtente.nome + "Scegli una posizione aperta per visualizzare gli indirizzi e-mail associati."
        });
    }

    async openedpositionsStep(step){


        const queryposap1 = 'SELECT "User".nome , "User".cognome , "User".email ';
        const queryposap2 = 'FROM "User" , "User_Pos" , "Posizioni_Aperte"';
        const queryposap3 = 'WHERE "Posizioni_Aperte".titolo = ' + "'" + step.result + "'" + ' AND "Posizioni_Aperte".idPosAp = "User_Pos".idPosAp AND "User_Pos".email = "User".email';

        var finalquery = queryposap1 + queryposap2 + queryposap3;
        await conn.query(finalquery).then((result) => {
            var text = "Candidati per la figura di " + step.result;
            this.texts.push({
                "type": "TextBlock",
                "size": "Default",
                "weight": "Bolder",
                "text": text,
                "separator": "true"
            });
            result.recordset.forEach(elem => {
                 this.texts.push({
                                   "type": "TextBlock",
                                   "text": elem.email + ' : ' + elem.cognome + ' : ' + elem.nome,
                                   "wrap": "true"
                                 });
                
            });
        });

        


    }

    async prefinalStep(step){
        const candidati = {
            "type": "AdaptiveCard",
            "body": 
                JSON.parse(JSON.stringify(this.texts))
            ,
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "version": "1.1"
        };

        await step.context.sendActivity({
            attachments: [CardFactory.adaptiveCard(candidati)]
        });
        return await step.prompt(TEXT_PROMPT, 'Vuoi effettuare un\'altra ricerca per posizione aperta?');
    }

    async finalStep(step) {
        const luisResult = await this.luisRecognizer.executeLuisQuery(step.context);
        if(step.result == 'no' || LuisRecognizer.topIntent(luisResult) === 'No'){
            return await step.endDialog();
        }
        else if(step.result == 'si' || LuisRecognizer.topIntent(luisResult) === 'Si'){
            return await step.replaceDialog(this.id, this.datiUtente);
        }
        else{
            await step.context.sendActivity("Non ho ben capito cosa intendi, facciamo un passo indietro..");
            return await step.endDialog();
        }
    }
    
   
}

module.exports.SPositionDialog = SPositionDialog;
module.exports.SPOSITION_DIALOG = SPOSITION_DIALOG;