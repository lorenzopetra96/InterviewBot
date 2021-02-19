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
import { SearchforemailDialog } from "./searchforemailDialog";
import { SearchforpositionDialog } from "./searchforpositionDialog";


const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const TEXT_PROMPT = 'TEXT_PROMPT';
const ADMIN_DIALOG = 'ADMIN_DIALOG';
const SEARCHFOREMAIL_DIALOG = 'SEARCHFOREMAIL_DIALOG';
const SEARCHFORPOSITION_DIALOG = 'SEARCHFORPOSITION_DIALOG';
var conn = require('./../../connectionpool.js');

export class AdminDialog extends ComponentDialog {
    private datiUtente;
    private luisRecognizer: InterviewBotRecognizer;
    constructor(luisRecognizer: InterviewBotRecognizer){
        super(ADMIN_DIALOG);

        this.luisRecognizer = luisRecognizer;
        //The primary goal of PromptDialog is an easy way to get input from the user and validate the data
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new SearchforemailDialog(luisRecognizer));
        this.addDialog(new SearchforpositionDialog(luisRecognizer));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
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

    async menuStep(step){

        this.datiUtente = step._info.options;
        const welcomeText = "Benvenuto " + this.datiUtente.nome + " " + this.datiUtente.cognome + ", come posso aiutarti?";
        

        const reply = {
            type: ActivityTypes.Message 
        };

        const buttons = [{
            type: ActionTypes.ImBack,
            title: 'Effettua una ricerca per utente',
            value: 'Utente'
        },
        {
            type: ActionTypes.ImBack,
            title: 'Effettua una ricerca per posizione aperta',
            value: 'Posizione'
        }];

        const card = CardFactory.heroCard(
            welcomeText,
            undefined,
            buttons
        );
        
        const message = MessageFactory.attachment(card);

        await step.context.sendActivity(message);

        return await step.prompt(TEXT_PROMPT, {
            prompt: 'Seleziona un\'opzione dal menu per proseguire!'
        });

    }

    async choiceStep(step){

        if(step.result == "Utente"){
            return await step.beginDialog(SEARCHFOREMAIL_DIALOG, this.datiUtente);
        }
        else if(step.result == "Posizione"){
            return await step.beginDialog(SEARCHFORPOSITION_DIALOG, this.datiUtente);
        }
        else{
            await step.context.sendActivity("Non hai effettuato nessuna scelta, quindi torniamo indietro di qualche passo..");
        }
       
        return step.next(step);
    }

    async prefinalStep(step){
        return await step.prompt(TEXT_PROMPT, 'Vuoi tornare al menù precedente?');
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

module.exports.AdminDialog = AdminDialog;
module.exports.ADMIN_DIALOG = ADMIN_DIALOG;