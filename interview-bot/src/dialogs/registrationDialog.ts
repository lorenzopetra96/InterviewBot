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
import { DatabaseConnection } from "./../../dbconnection";

const { Connection, Request } = require("tedious");

const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const TEXT_PROMPT = 'TEXT_PROMPT';
const REGISTRATION_DIALOG = 'REGISTRATION_DIALOG';


var conn = require('./../../connectionpool.js');


export class RegistrationDialog extends ComponentDialog {

    constructor(){
        super(REGISTRATION_DIALOG);

        
        //The primary goal of PromptDialog is an easy way to get input from the user and validate the data
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.welcomeStep.bind(this),
                this.emailStep.bind(this),
                this.surnameStep.bind(this),
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

        if (!step.values.email) {
            return await step.prompt(TEXT_PROMPT, 'Ho bisogno di un indirizzo e-mail valido per registrarti. Qual è il tuo?');

        } else {
            return await step.next(step.values.email);
        }
    }


    async emailStep(step) {
        
        let regexpEmail = new RegExp('[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,3}');
        step.values.email = step.result;

        if(!regexpEmail.test(step.values.email)){
            await step.context.sendActivity("E-mail non valida.. deve essere di un formato simile a rossi@ninini.it, riprova da capo");
            return await step.replaceDialog(this.id);

        }else{

            if (!step.values.surname) {
                return await step.prompt(TEXT_PROMPT, 'Mi servirebbe il tuo cognome.');

            } else {
                return await step.next(step.values.surname);
            }
        }
        
    }

    async surnameStep(step) {

        step.values.surname = step.result;
       
        if (!step.values.name) {
            return await step.prompt(TEXT_PROMPT, 'Mi servirebbe il tuo nome.');

        } else {
            return await step.next(step.values.name);
        }


    }

    async finalStep(step) {

        
        step.values.name = step.result;

        const data = step.values;
        data.email = step.values.email;
        data.cognome = step.values.surname;
        data.nome = step.values.name;


        var sql1 = 'INSERT INTO "User"(email,nome,cognome,ruolo) VALUES';
        var sql2 = "('" + data.email + "','" + data.nome + "','" + data.cognome + "'," + 1 + ");";
        var finalquery = sql1.concat(sql2);
        console.log(finalquery);

        conn.query(finalquery).then((result) => console.log(result));

              
        await step.context.sendActivity("Registrato con successo. Ora facciamo qualche passo indietro");
        
        return await step.endDialog();
    }

    

}

module.exports.RegistrationDialog = RegistrationDialog;
module.exports.REGISTRATION_DIALOG = REGISTRATION_DIALOG;