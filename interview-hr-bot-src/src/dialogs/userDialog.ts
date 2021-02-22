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
import { InterviewDialog } from "./interviewDialog";
import * as AdaptiveCards from "adaptivecards";
var cardJSON = require("../../images/cards/infoCard.json");

const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const TEXT_PROMPT = 'TEXT_PROMPT';
const USER_DIALOG = 'USER_DIALOG';
const INTERVIEW_DIALOG = 'INTERVIEW_DIALOG';
//Oggetto ConnectionPool per effettuare la connessione al database
var conn = require('./../../connectionpool.js');

export class UserDialog extends ComponentDialog {
    private res;
    private luisRecognizer: InterviewBotRecognizer;
    private datiUtente;
    constructor(luisRecognizer: InterviewBotRecognizer){
        super(USER_DIALOG);
        this.luisRecognizer = luisRecognizer;
        
        //The primary goal of PromptDialog is an easy way to get input from the user and validate the data
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new InterviewDialog(luisRecognizer));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.welcomeStep.bind(this),
                this.menuStep.bind(this),
                this.choiceStep.bind(this),
                this.prefinalStep.bind(this),
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
        var finalquery = 'SELECT * FROM "User_Pos"' + "WHERE email='" + this.datiUtente.email + "';";
        
        
        console.log(finalquery);
        //Viene controllato se l'utente ha già effettuato un colloquio.
        //In caso positivo, può solo visualizzare le informazioni dell'azienda.
        await conn.query(finalquery).then((result) => {
            this.res = result;
            console.log(result);
        });

    
        return await step.next(step);
        

    }

    async menuStep(step){
        var card;
        //Se il contenuto del risultato della query dello step precedente è vuoto
        //allora può sia effettuare un colloquio che visualizzare le informazioni 
        //dell'azienda
        if(this.res.rowsAffected == 0){
            
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
                "Benvenuto " + this.datiUtente.nome + " " + this.datiUtente.cognome + " !",
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
                    "Benvenuto " + this.datiUtente.nome + " " + this.datiUtente.cognome + " !",
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

        const luisResult = await this.luisRecognizer.executeLuisQuery(step.context);
        if(step.result == "Info" || LuisRecognizer.topIntent(luisResult) === 'Info'){
            await step.context.sendActivity({
                attachments: [CardFactory.adaptiveCard(cardJSON)]
            });

        }
        else if(step.result == "Colloquio" || LuisRecognizer.topIntent(luisResult) === 'Colloquio'){
            if(this.res.rowsAffected != 0){
                await step.context.sendActivity("Mi dispiace ma hai già effettuato un colloquio, puoi solo visualizzare le informazioni dell'azienda:");
                
                return await step.replaceDialog(this.id, this.datiUtente); 
            }
            else{
                return await step.beginDialog(INTERVIEW_DIALOG, this.datiUtente);
            }
        }
        else{
            await step.context.sendActivity("Non hai effettuato nessuna scelta, quindi torniamo indietro di qualche passo..");
        }

        return await step.next(step);
        
    }

    async prefinalStep(step){

        return await step.prompt(TEXT_PROMPT, 'Vuoi tornare al menù precedente?');

    }

    async finalStep(step){
        const luisResult = await this.luisRecognizer.executeLuisQuery(step.context);
        if(step.result == 'no' || LuisRecognizer.topIntent(luisResult,'None',0.3) === 'No'){
            return await step.endDialog();
        }
        else if(step.result == 'si' || LuisRecognizer.topIntent(luisResult,'None',0.3) === 'Si'){
            return await step.replaceDialog(this.id, this.datiUtente);
        }
        else{
            await step.context.sendActivity("Non ho ben capito cosa intendi, facciamo un passo indietro..");
            return await step.endDialog();
        }
    }

   
}

module.exports.UserDialog = UserDialog;
module.exports.USER_DIALOG = USER_DIALOG;