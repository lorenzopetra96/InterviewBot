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
const ADMIN_DIALOG = 'ADMIN_DIALOG';

export class AdminDialog extends ComponentDialog {

    constructor(){
        super(ADMIN_DIALOG);

        
        //The primary goal of PromptDialog is an easy way to get input from the user and validate the data
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.menuStep.bind(this),
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

        const welcomeText = "Benvenuto Lorienzo, come posso aiutarti?"
        await step.context.sendActivity(welcomeText);

        const reply = {
            type: ActivityTypes.Message 
        };

        const buttons = [{
            type: ActionTypes.ImBack,
            title: 'Visualizza gli ultimi colloqui',
            value: 'Colloqui'
        },
        {
            type: ActionTypes.ImBack,
            title: 'Effettua una ricerca per utente/posizione',
            value: 'Ricerca'
        }];

        const card = CardFactory.heroCard(
            '',
            undefined,
            buttons, {
                text: 'Vuoi visualizzare gli ultimi colloqui o effettuare una ricerca?'
            }
        );
        
        const message = MessageFactory.attachment(card);

        await step.context.sendActivity(message);

        return await step.prompt(TEXT_PROMPT, {
            prompt: 'Seleziona un\'opzione dal menu per proseguire!'
        });

    }

    async choiceStep(step){

       

    }

    async finalStep(step) {
        return await step.endDialog();
    }
    
   
}

module.exports.AdminDialog = AdminDialog;
module.exports.ADMIN_DIALOG = ADMIN_DIALOG;