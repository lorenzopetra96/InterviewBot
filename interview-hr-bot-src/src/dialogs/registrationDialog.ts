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


const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const TEXT_PROMPT = 'TEXT_PROMPT';
const REGISTRATION_DIALOG = 'REGISTRATION_DIALOG';

//Oggetto ConnectionPool per effettuare la connessione al database
var conn = require('./../../connectionpool.js');


export class RegistrationDialog extends ComponentDialog {
    private luisRecognizer: InterviewBotRecognizer;
    constructor(luisRecognizer: InterviewBotRecognizer){
        super(REGISTRATION_DIALOG);
        this.luisRecognizer = luisRecognizer;
        
        //The primary goal of PromptDialog is an easy way to get input from the user and validate the data
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.welcomeStep.bind(this),
                this.choiceStep.bind(this),
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

            return await step.prompt(TEXT_PROMPT, 'Sei sicuro di volerti registrare?');
            
    }

    async choiceStep(step){
        // Call LUIS and gather user request.
        const luisResult = await this.luisRecognizer.executeLuisQuery(step.context);
        if(step.result == 'no' || LuisRecognizer.topIntent(luisResult,'None',0.3) === 'No'){
            return await step.endDialog();
        }
        else if(step.result == 'si' || LuisRecognizer.topIntent(luisResult,'None',0.3) === 'Si'){
            return await step.prompt(TEXT_PROMPT, 'Ho bisogno di un indirizzo e-mail valido per registrarti.\n\nInserisci il tuo indirizzo e-mail');
        }
        else{
            await step.context.sendActivity("Non ho ben capito cosa intendi, facciamo un passo indietro..");
            return await step.endDialog();
        }
    }


    async emailStep(step) {
        //Controllo sul formato dell'indirizzo e-mail inserito
        let regexpEmail = new RegExp('[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,3}');
        step.values.email = step.result;
        var error;
        await conn.query('SELECT * FROM "User" WHERE "User".email=' + "'" + step.result + "';").then(result =>{
            error=result;
        });
        console.log(error);
        if(!regexpEmail.test(step.values.email)){
            await step.context.sendActivity("E-mail non valida.. deve essere di un formato simile a rossi@xxxxx.it, riprova!");
            return await step.replaceDialog(this.id);

        }else if(error.rowsAffected==0) return await step.prompt(TEXT_PROMPT, 'Indirizzo e-mail corretto. Ora inserisci il tuo cognome');
        else {
            await step.context.sendActivity("Mi dispiace ma è già presente un profilo associato a questo indirizzo e-mail");
            return await step.replaceDialog(this.id);
        }
    }

    async surnameStep(step) {

        step.values.surname = step.result;

        return await step.prompt(TEXT_PROMPT, 'Inserisci il tuo nome');


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
        //Inserimento del profilo utente nel db
        await conn.query(finalquery).then((result) => console.log(result));
   
        await step.context.sendActivity("Registrato con successo. Torniamo al menù principale...");
        
        return await step.endDialog();
    }

    

}

module.exports.RegistrationDialog = RegistrationDialog;
module.exports.REGISTRATION_DIALOG = REGISTRATION_DIALOG;