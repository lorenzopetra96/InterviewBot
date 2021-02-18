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
const SEARCHFOREMAIL_DIALOG = 'SEARCHFOREMAIL_DIALOG';
var conn = require('./../../connectionpool.js');

export class SearchforemailDialog extends ComponentDialog {
    private datiUtente;
    private luisRecognizer: InterviewBotRecognizer;
    private credenziali;
    private quiz;
    private texts = [];
    private facts = [];
    constructor(luisRecognizer: InterviewBotRecognizer){
        super(SEARCHFOREMAIL_DIALOG);

        this.luisRecognizer = luisRecognizer;
        //The primary goal of PromptDialog is an easy way to get input from the user and validate the data
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.welcomeStep.bind(this),
                this.dbStep.bind(this),
                this.testStep.bind(this),
                this.prefinalStep(this),
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
        
        return await step.prompt(TEXT_PROMPT, {
            prompt: this.datiUtente.nome + "Inserisci l'indirizzo e-mail dell'utente per visualizzare il test effettuato."
        });

    }

    async dbStep(step){

        const querycredenz1 = 'SELECT "User".nome , "User".cognome , "Posizioni_Aperte".titolo';
        const querycredenz2 = 'FROM "User" , "Posizioni_Aperte" , "User_Pos"';
        const querycredenz3 = 'WHERE "User_Pos".idPosAp = "Posizioni_Aperte".idPosAp AND "User_Pos".email = "User".email AND "User".email =' + "'" + step.result + "';"
        var finalquery = querycredenz1 + querycredenz2 + querycredenz3;
        await conn.query(finalquery).then(result => {
            this.credenziali = result;
        });

        const queryquiz1 = 'SELECT  Quiz".domanda, "Quiz".rispcorretta , "User_Quiz".risposta , "User_Quiz".punteggio';
        const queryquiz2 = 'FROM  "Quiz" , "User_Quiz"';
        const queryquiz3 = 'WHERE "User_Quiz".email = ' + "'" + step.result + "'" + ' AND "User_Quiz".idQuiz = "Quiz".idQuiz'
        
        finalquery = queryquiz1 + queryquiz2 + queryquiz3;
        await conn.query(finalquery).then(result => {
            this.quiz = result;
        });


        return await step.next(step);

    }

    async testStep(step){

        if(this.quiz.rowsAffected != 0){
            
            this.texts.push({
                "type": "TextBlock",
                "size": "Medium",
                "weight": "Bolder",
                "text": this.credenziali.nome + ' ' + this.credenziali.cognome,
                "horizontalAlignment": "Center",
                "separator": "true"
            });

            this.facts.push({
                "title":"Posizione",
                "value": this.credenziali.titolo
            });
            for(var i = 0; i<3 ; i++){
                this.facts.push({
                    "title": "Domanda",
                    "value": this.quiz.recordset[0].domanda
                });
                this.facts.push({
                    "title": "Risp esatta",
                    "value": this.quiz.recordset[0].rispcorretta
                });
                this.facts.push({
                    "title": "Risp data",
                    "value": this.quiz.recordset[0].risposta
                });
                this.facts.push({
                    "title": "Punteggio",
                    "value": this.quiz.recordset[0].punteggio
                });
            }

            this.texts.push({
                "type": "FactSet",
                "facts": JSON.parse(JSON.stringify(this.facts))
            });
            
            const card = {
                "type": "AdaptiveCard",
                "body": 
                    JSON.parse(JSON.stringify(this.texts))
                ,
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "version": "1.1"
            };

            return await step.context.sendActivity({
                attachments: [CardFactory.adaptiveCard(card)]
            });
        }
        else{
            return await step.context.sendActivity("Non è stato trovato nessun test associato a questo indirizzo e-mail.");
        }
    }


    async prefinalStep(step){
        return await step.prompt(TEXT_PROMPT, 'Vuoi effettuare un\'altra ricerca per indirizzo e-mail?');
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

module.exports.SearchforemailDialog = SearchforemailDialog;
module.exports.SEARCHFOREMAIL_DIALOG = SEARCHFOREMAIL_DIALOG;