import { ActivityHandler, MessageFactory , ActivityTypes, ActionTypes, CardFactory, BotCallbackHandlerKey } from "botbuilder";
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

import * as AdaptiveCards from "adaptivecards";
var cardJSON = require("../../images/cards/infoCard.json");

const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const TEXT_PROMPT = 'TEXT_PROMPT';
const USER_DIALOG = 'USER_DIALOG';

var conn = require('./../../connectionpool.js');

export class UserDialog extends ComponentDialog {
    private res;
    private datiUtente;
    constructor(){
        super(USER_DIALOG);

        
        //The primary goal of PromptDialog is an easy way to get input from the user and validate the data
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.welcomeStep.bind(this),
                this.menuStep.bind(this),
                this.choiceStep.bind(this),
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
        console.log("SONO IN USERDIALOG: ");
        var finalquery = 'SELECT * FROM "User_Pos"' + "WHERE email='" + this.datiUtente.email + "';";
        
        
        console.log(this.datiUtente.nome + " " + this.datiUtente.cognome);
        await conn.query(finalquery).then((result) => {
            this.res = result;
            console.log(result);
        });

        const welcomeText = "Benvenuto " + this.datiUtente.nome + " " + this.datiUtente.cognome + " !"
        await step.context.sendActivity(welcomeText);
        return await step.next(step);
        

    }

    async menuStep(step){
        var card;
        console.log("NUMERO: " + this.res.rowCount);
        if(this.res.rowCount === undefined){
            
            const buttons = [{
                type: ActionTypes.ImBack,
                title: "Visualizza le informazioni dell'azienda",
                value: 'Info'
            },
            {
                type: ActionTypes.ImBack,
                title: 'Effettua un colloquio',
                value: 'Colloquio'
            }];
    
            card = CardFactory.heroCard(
                '',
                undefined,
                buttons, {
                    text: "Vuoi visualizzare le informazioni dell'azienda o effettuare un colloquio?"
                }
            );
            }
            else{
    
                await step.context.sendActivity("Da un controllo in database, risulta che hai già effettuato un colloquio.\nQuindi puoi solo visualizzare le informazioni dell'azienda.");
                const reply = {
                    type: ActivityTypes.Message 
                };
        
        
        
                const buttons = [{
                    type: ActionTypes.ImBack,
                    title: "Visualizza le informazioni dell'azienda",
                    value: 'Info'
                }];
        
                card = CardFactory.heroCard(
                    '',
                    undefined,
                    buttons, {
                        text: "Vuoi visualizzare le informazioni dell'azienda?"
                    }
                ); 
            }
            const message = MessageFactory.attachment(card);
    
            await step.context.sendActivity(message);
    
            return await step.prompt(TEXT_PROMPT, {
                prompt: 'Seleziona un\'opzione dal menu per proseguire!'
            });

    }

    async choiceStep(step){

        if(step.result == "Info"){
            console.log(cardJSON);
            await step.context.sendActivity({
                attachments: [CardFactory.adaptiveCard(cardJSON)]
            });

        }
        else if(step.result == "Colloquio"){
            if(this.res.rowCount != undefined){
                await step.context.sendActivity("Mi dispiace ma hai già effettuato un colloquio, puoi solo visualizzare le informazioni dell'azienda:");
                return await step.context.sendActivity({
                    attachments: [CardFactory.adaptiveCard(cardJSON)]
                });
            }
            else{

            }
        }
        else{
            await step.context.sendActivity("Non hai effettuato nessuna scelta, quindi torniamo indietro di qualche passo..");
            return await step.replaceDialog(this.id,this.datiUtente);
        }

    }

    async finalStep(step) {
        return await step.endDialog();
    }
    
   
}

module.exports.UserDialog = UserDialog;
module.exports.USER_DIALOG = USER_DIALOG;