import { ActivityHandler, MessageFactory , ActivityTypes } from "botbuilder";
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
import { AdminDialog } from "./adminDialog";
import { RegistrationDialog } from "./registrationDialog";
import { UserDialog } from "./userDialog";

const MAIN_DIALOG = 'MAIN_DIALOG';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const TEXT_PROMPT = 'TEXT_PROMPT';
const REGISTRATION_DIALOG = 'REGISTRATION_DIALOG';
const USER_DIALOG = 'USER_DIALOG';
const ADMIN_DIALOG = 'ADMIN_DIALOG';

var conn = require('./../../connectionpool.js');

export class MainDialog extends ComponentDialog {
    private luisRecognizer: InterviewBotRecognizer;
    private res;
    private registrazione = false;
    constructor(luisRecognizer: InterviewBotRecognizer, userState){
        super(MAIN_DIALOG);

        if (!luisRecognizer) throw new Error('[MainDialog]: Missing parameter \'luisRecognizer\' is required');
        this.luisRecognizer = luisRecognizer;
        
        //The primary goal of PromptDialog is an easy way to get input from the user and validate the data
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new RegistrationDialog());
        this.addDialog(new UserDialog(luisRecognizer));
        this.addDialog(new AdminDialog(luisRecognizer));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.welcomeStep.bind(this),
                this.identificationStep1.bind(this),
                this.identificationStep2.bind(this),
                this.identificationStep3.bind(this),
                this.loopStep.bind(this)
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
    
    async welcomeStep(step) {
        if (!this.luisRecognizer.isConfigured) {
            var messageText1 = 'ATTENZIONE: LUIS non configurato. Controlla il file .env!';
            await step.context.sendActivity(messageText1, null, InputHints.IgnoringInput);
            return await step.next();
        }
        
        const messageText = step.options.restartMsg ? step.options.restartMsg : "Se vuoi avere informazioni riguardo l'azienda devi prima registrarti.\nCi conosciamo già?" ;
        const promptMessage = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
        return await step.prompt(TEXT_PROMPT, {
            prompt: promptMessage
        });
    }

    async identificationStep1(step) {
        const message = step.result;
        var email: any;
        var nome: any;
        var cognome: any;
        let regexpEmail = new RegExp('^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,4}$');
        const reply = {
            type: ActivityTypes.Message
        };
        // Call LUIS and gather user request.
        const luisResult = await this.luisRecognizer.executeLuisQuery(step.context);
        
        if(message == 'no' || LuisRecognizer.topIntent(luisResult) === 'No'){
            await step.context.sendActivity("Allora è il momento di registrarsi!");
            this.registrazione = true;
            return await step.beginDialog(REGISTRATION_DIALOG);

        }
        else if(message == 'si' || LuisRecognizer.topIntent(luisResult) === 'Si'){
            await step.context.sendActivity("Ah ci conosciamo già, dimmi con quale indirizzo e-mail ti sei registrato.");
            if (!step.values.email) {
                return await step.prompt(TEXT_PROMPT, 'Mi servirebbe il tuo indirizzo e-mail.');
    
            } else {
                return await step.next(step.values.email);
            }
        }
        else{
            return await step.replaceDialog(this.id);
        }

    }

    async identificationStep2(step){
        if(this.registrazione) {this.registrazione = false; return await step.replaceDialog(this.id);}
        step.values.email = step.result;
        var finalquery = "SELECT * FROM" + ' "User"' + " WHERE email = '" + step.values.email + "';"; 
        
        await conn.query(finalquery).then((result) => {
            this.res = result;
        });

        //await step.context.sendActivity("Dammi pochi secondi per controllare..");
        return await step.next(step);
    }

    async identificationStep3(step){
        if(this.res.rowsAffected != 0){
            let email;
            let ruolo;
            var datiUtente;
            this.res.recordset.forEach(elem => {email=elem.email; ruolo=elem.ruolo; datiUtente=elem});
            if(ruolo==0){
                return await step.beginDialog(ADMIN_DIALOG, datiUtente);
            }
            else if(ruolo==1){
                return await step.beginDialog(USER_DIALOG, datiUtente);
            }
            
        }
        else{
            await step.context.sendActivity("Non ho trovato nessun account associato a questo indirizzo e-mail\nFacciamo un passo indietro..");

            return await step.replaceDialog(this.id);
        }
    }


    async loopStep(step) {
        return await step.replaceDialog(this.id);
    }

}

module.exports.MainDialog = MainDialog;
module.exports.MAIN_DIALOG = MAIN_DIALOG;