import { TextBlock } from "adaptivecards";
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
const INTERVIEW_DIALOG = 'INTERVIEW_DIALOG';
var conn = require('./../../connectionpool.js');
const axios = require('axios');
const SUBSCRIPTION_KEY = process.env['BING_SEARCH_V7_SUBSCRIPTION_KEY'];


export class InterviewDialog extends ComponentDialog {
    private datiUtente;
    private luisRecognizer: InterviewBotRecognizer;
    private texts = [];
    private res;
    private buttons = [];
    private quiz = [];
    private risposte = [];
    private posizione_scelta;
    private idPosizioneScelta;
    private urls = [];
    constructor(luisRecognizer: InterviewBotRecognizer){
        super(INTERVIEW_DIALOG);
        this.luisRecognizer = luisRecognizer;

        
        //The primary goal of PromptDialog is an easy way to get input from the user and validate the data
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.menuStep.bind(this),
                this.choiceStep.bind(this),
                this.prequizStep.bind(this),
                this.firstquestionStep.bind(this),
                this.secondquestionStep.bind(this),
                this.thirdquestionStep.bind(this),
                this.resultStep.bind(this),
                this.mailStep.bind(this)
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
        var finalquery = 'SELECT * FROM "Posizioni_Aperte";';
        await conn.query(finalquery).then((result) => {
            this.res = result;
            this.texts.push({
                "type": "TextBlock",
                "size": "Large",
                "weight": "Bolder",
                "text": "Posizioni aperte:"
            });
            result.recordset.forEach(elem => {
                 this.texts.push({
                                   "type": "TextBlock",
                                   "text": elem.titolo + ': ' + elem.descrizione,
                                   "wrap": "true",
                                   "separator": "true"
                                 });
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

        const posizioni_aperte = {
            "type": "AdaptiveCard",
            "body": 
                JSON.parse(JSON.stringify(this.texts))
            ,
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "version": "1.1"
        };
        var card = CardFactory.heroCard(
            'Scegli per quale figura ti interessa fare un colloquio',
            undefined,
            JSON.parse(JSON.stringify(this.buttons))
        );
        const options = MessageFactory.attachment(card);
        await step.context.sendActivity({
            attachments: [CardFactory.adaptiveCard(posizioni_aperte)]
        });

        await step.context.sendActivity(options);
        return await step.prompt(TEXT_PROMPT, {
            prompt: 'Seleziona un\'opzione dal menu per proseguire!'
        });

    }

    async prequizStep(step){

        

        this.res.recordset.forEach(elem => {
            if(step.result == elem.titolo){
                this.posizione_scelta = elem.titolo;
                this.idPosizioneScelta = elem.idPosAp;
                return;
            }
        });
                   
        const finalquery =  'SELECT "Quiz".idQuiz,"Quiz".domanda, "Quiz".primarisp, "Quiz".secondarisp, "Quiz".terzarisp, "Quiz".rispcorretta FROM "Posizioni_Aperte" , "Quiz_Pos" , "Quiz" WHERE "Posizioni_Aperte".idPosAp = "Quiz_Pos".idPosAp AND "Quiz_Pos".idQuiz = "Quiz".idQuiz AND "Posizioni_Aperte".titolo =' + "'" + this.posizione_scelta + "';";
        await conn.query(finalquery).then(result => {
                var numbers = [];
                var elem;
                while(numbers.length!=3){
                    elem = Math.floor(Math.random() * result.rowsAffected);
                    console.log("Elem: " + elem);
                    if(!numbers.includes(elem)) numbers.push(elem);
                    if(numbers.length==3) numbers.sort();
                }
                console.log(numbers);
                
                for(var i=0;i<result.rowsAffected;i++){
                    if(numbers[0]==i){
                        this.quiz.push(result.recordset[i]);
                        numbers.shift();
                    }
                }
    
    
            });


        return await step.prompt(TEXT_PROMPT, {
            prompt: "Hai scelto di candidarti per la figura di " + this.posizione_scelta + ", ora ti sottoporrò ad un breve test"
                    + " per verificare le tue conoscenze. \nIl test sarà a risposta multipla, dovrai quindi cliccare sull'opzione"
                    + " per te più convincente.\n QUALUNQUE ALTRA RISPOSTA DIVERSA DA QUELLE ELENCATE PORRÀ FINE AL TEST.\n Sei pronto?"
        });
    }

    async firstquestionStep(step){

        const luisResult = await this.luisRecognizer.executeLuisQuery(step.context);
        if(step.result == "si" || LuisRecognizer.topIntent(luisResult) === 'Si'){


            const buttons = [{
                type: ActionTypes.ImBack,
                title: "1) " + this.quiz[0].primarisp,
                value: this.quiz[0].primarisp
            },
            {
                type: ActionTypes.ImBack,
                title: "2) " + this.quiz[0].secondarisp,
                value: this.quiz[0].secondarisp
            },
            {
                type: ActionTypes.ImBack,
                title: "3) " + this.quiz[0].terzarisp,
                value: this.quiz[0].terzarisp
            }];

            var card = CardFactory.heroCard(
                '',
                undefined,
                JSON.parse(JSON.stringify(buttons)),
                { text: this.quiz[0].domanda}
            );

            await step.context.sendActivity(MessageFactory.attachment(card));
            return await step.prompt(TEXT_PROMPT, {
                prompt: 'Seleziona una risposta per proseguire!'
            });

        }
        else if(step.result == 'no' || LuisRecognizer.topIntent(luisResult) === 'No'){
            clean();
            await step.context.sendActivity("Perfetto, allora torniamo qualche passo indietro..");
            return await step.endDialog();
        }
        else{
            clean();
            await step.context.sendActivity("Non ho ben capito cosa hai scritto quindi torniamo qualche passo indietro..");
            return await step.beginDialog(INTERVIEW_DIALOG, this.datiUtente);
        }
    }

    async secondquestionStep(step){
        this.risposte.push(step.result);

        const risposte = [{
            type: ActionTypes.ImBack,
            title: "1) " + this.quiz[1].primarisp,
            value: this.quiz[1].primarisp
        },
        {
            type: ActionTypes.ImBack,
            title: "2) " + this.quiz[1].secondarisp,
            value: this.quiz[1].secondarisp
        },
        {
            type: ActionTypes.ImBack,
            title: "3) " + this.quiz[1].terzarisp,
            value: this.quiz[1].terzarisp
        }];

        var card = CardFactory.heroCard(
            '',
            undefined,
            risposte,
            { text: this.quiz[1].domanda}
        );

        await step.context.sendActivity(MessageFactory.attachment(card));
        return await step.prompt(TEXT_PROMPT, {
            prompt: 'Seleziona una risposta per proseguire!'
        });
    }
    
    async thirdquestionStep(step){
        this.risposte.push(step.result);

        const risposte = [{
            type: ActionTypes.ImBack,
            title: "1) " + this.quiz[2].primarisp,
            value: this.quiz[2].primarisp
        },
        {
            type: ActionTypes.ImBack,
            title: "2) " + this.quiz[2].secondarisp,
            value: this.quiz[2].secondarisp
        },
        {
            type: ActionTypes.ImBack,
            title: "3) " + this.quiz[2].terzarisp,
            value: this.quiz[2].terzarisp
        }];

        var card = CardFactory.heroCard(
            '',
            undefined,
            risposte,
            { text: this.quiz[2].domanda}
        );

        await step.context.sendActivity(MessageFactory.attachment(card));
        return await step.prompt(TEXT_PROMPT, {
            prompt: 'Seleziona una risposta per proseguire!'
        });
    }

    async resultStep(step){
        this.risposte.push(step.result);
        var punteggio = [];
        for(var i = 0; i < 3; i++){
            if(this.risposte[i]==this.quiz[i].rispcorretta) punteggio.push(1);
            else punteggio.push(0);
        }

        console.log("Punteggio: " + punteggio);
        
        //await conn.query('INSERT INTO "User_Pos"(email,idPosAp) VALUES ' + "('" + this.datiUtente.email + "','" + this.idPosizioneScelta + "');").then(res => {console.log("INSERITA ASSOCIAZIONE POSIZIONE-UTENTE\n" + res);});
        
        //await conn.query('INSERT INTO "User_Quiz"(email,idQuiz,risposta,punteggio) VALUES ' + "('" + this.datiUtente.email + "','" + this.quiz[0].idQuiz + "','" + this.risposte[0] + "','" + punteggio[0] + "');").then(res => {console.log("PRIMO QUIZ INSERITO\n" + res);});
        //await conn.query('INSERT INTO "User_Quiz"(email,idQuiz,risposta,punteggio) VALUES ' + "('" + this.datiUtente.email + "','" + this.quiz[1].idQuiz + "','" + this.risposte[1] + "','" + punteggio[1] + "');").then(res => {console.log("SECONDO QUIZ INSERITO\n" + res);});
        //await conn.query('INSERT INTO "User_Quiz"(email,idQuiz,risposta,punteggio) VALUES ' + "('" + this.datiUtente.email + "','" + this.quiz[2].idQuiz + "','" + this.risposte[2] + "','" + punteggio[2] + "');").then(res => {console.log("TERZO QUIZ INSERITO\n" + res);});
        
        
        for(var i = 0; i<punteggio.length; i++){
            if(!punteggio[i]) this.urls.push(bingQuery(this.quiz[i].domanda));
            else this.urls.push("Risposta esatta");
        }

        await step.context.sendActivity(this.datiUtente.nome + " hai totalizzato un punteggio pari a " + punteggio[0] + punteggio[1] + punteggio[2] + "\nA breve ti invierò un'e-mail con il test corretto.\nRicorda che da ora in poi potrai solo visualizzare le informazioni dell'azienda.");
        
    }
 
    async mailStep(step){

        

    }

    async finalStep(step){

    }


    
   
}

function bingQuery(query){
    var url = 'https://api.bing.microsoft.com/v7.0/search?q=' + encodeURIComponent(query);
    var result;
    axios.get(url, {
        headers: {
            'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
            "Accept": "application/json",
            'location' : 'global'
        },
    }).then(res => {
      console.log(res.data.webPages.value[0].url);
      result = res;
    })
    return result;

}

function clean(){
    this.quiz = [];
    this.texts = [];
    this.res = null;
    this.buttons = [];
    this.risposte = [];
    this.posizione_scelta = null;
    this.idPosizioneScelta = null;
    this.urls = [];
}


module.exports.InterviewDialog = InterviewDialog;
module.exports.INTERVIEW_DIALOG = INTERVIEW_DIALOG;