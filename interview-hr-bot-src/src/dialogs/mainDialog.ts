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
//Oggetto ConnectionPool per effettuare la connessione al database
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
        this.addDialog(new RegistrationDialog(luisRecognizer));
        this.addDialog(new UserDialog(luisRecognizer));
        this.addDialog(new AdminDialog(luisRecognizer));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.welcomeStep.bind(this),
                this.registrationcheckStep.bind(this),
                this.dbStep.bind(this),
                this.choiceStep.bind(this),
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

    async registrationcheckStep(step) {
        const message = step.result;
        
        // Call LUIS and gather user request.
        const luisResult = await this.luisRecognizer.executeLuisQuery(step.context);
        
        if(message == 'no' || LuisRecognizer.topIntent(luisResult,'None',0.3) === 'No'){
            await step.context.sendActivity("Allora è il momento di registrarsi!");
            //In caso di registrazione, viene utilizzata 'registrazione' per ripartire dal primo step del dialog
            this.registrazione = true;
            return await step.beginDialog(REGISTRATION_DIALOG);

        }
        else if(message == 'si' || LuisRecognizer.topIntent(luisResult,'None',0.3) === 'Si'){
            await step.context.sendActivity("Ah ci conosciamo già, dimmi con quale indirizzo e-mail ti sei registrato.");
            if (!step.values.email) {
                return await step.prompt(TEXT_PROMPT, 'Mi servirebbe il tuo indirizzo e-mail.');
    
            } else {
                return await step.next(step.values.email);
            }
        }
        else{
            await step.context.sendActivity("Non ho ben capito cosa mi hai detto, facciamo un passo indietro..");
            return await step.replaceDialog(this.id);
        }

    }

    async dbStep(step){
        //Viene controllato il valore di registrazione, TRUE -> replaceDialog e si riparte dal primo step
        if(this.registrazione) {this.registrazione = false; return await step.replaceDialog(this.id);}
        step.values.email = step.result;
        var finalquery = "SELECT * FROM" + ' "User"' + " WHERE email = '" + step.values.email + "';"; 
        
        await conn.query(finalquery).then((result) => {
            this.res = result;
        });

        return await step.next(step);
    }

    async choiceStep(step){
        //Se il contenuto del risultato della query dello step precedente è vuoto allora si riparte dal primo step del dialog
        //altrimenti viene chiamato il dialog corrispondente al ruolo associato all'indirizzo e-mail inserito dall'utente
        if(this.res.rowsAffected != 0){
            let email, ruolo;
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
            await step.context.sendActivity("Non ho trovato nessun account associato a questo indirizzo e-mail\n\nFacciamo un passo indietro..");

            return await step.replaceDialog(this.id);
        }
    }


    async loopStep(step) {
        return await step.replaceDialog(this.id);
    }

}

module.exports.MainDialog = MainDialog;
module.exports.MAIN_DIALOG = MAIN_DIALOG;