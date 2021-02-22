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
//Oggetto ConnectionPool per effettuare la connessione al database
var conn = require('./../../connectionpool.js');
const axios = require('axios');
const SUBSCRIPTION_KEY = process.env.BING_SEARCH_V7_SUBSCRIPTION_KEY;
const FUNCTION_ENDPOINT = process.env.AzureFunctionEndPoint;

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
    private emailadmin;
    private punteggio = [];
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
                this.mailStep.bind(this),

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
        //Vengono prelevate le info riguardo le posizioni aperte e viene costruito 
        //il JSON per la card dello step successivo
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
        //Card per le posizioni aperte presenti nel database
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

        //Controllo sulla posizione scelta nello step precedente, se esiste allora viene creato il test
        //altrimenti si riparte dal primo step
        for(var i = 0; i<this.res.rowsAffected; i++){
            if(this.res.recordset[i].titolo == step.result){
                this.posizione_scelta = this.res.recordset[i].titolo;
                this.idPosizioneScelta = this.res.recordset[i].idPosAp;
                break;
            }
            else if(i == (this.res.rowsAffected - 1)){
                clean();
                await step.context.sendActivity("Non hai scelto nessuna delle posizioni aperte elencate, quindi torniamo qualche passo indietro");
                return await step.replaceDialog(this.id, this.datiUtente); 
            }
        }

        //Il prelievo delle domande e risposte per il test viene fatto in base a tre valori randomici.
        //Quindi, ogniqualvolta si vuole effettuare un test vengono presentati 3 oggetti 'Quiz' sempre diversi, 
        //ovviamente in riferimento alla posizione aperta scelta
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
                    + " per verificare le tue conoscenze. \n\nIl test sarà a risposta multipla, dovrai quindi cliccare sull'opzione"
                    + " per te più convincente.\n\nQUALUNQUE ALTRA RISPOSTA DIVERSA DA QUELLE ELENCATE SARÀ CONSIDERATA ERRATA!\n\n Sei pronto?"
        });
    }

    async firstquestionStep(step){

        const luisResult = await this.luisRecognizer.executeLuisQuery(step.context);
        if(step.result == "si" || LuisRecognizer.topIntent(luisResult) === 'Si'){

            //Creazione card del primo Quiz
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
            return await step.replaceDialog(this.id, this.datiUtente);
        }
    }

    async secondquestionStep(step){
        //Le risposte vengono inserite nell'array risposte
        this.risposte.push(step.result);

        //Tramite il servizio di Azure Bing Web Search, viene effettuata una ricerca web 
        //in base alla domanda effettuata, il link nella prima posizione viene inserito nell'array urls
        var url = 'https://api.bing.microsoft.com/v7.0/search?q=' + encodeURIComponent(this.quiz[0].domanda);
        await axios.get(url, {
            headers: {
                'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
                "Accept": "application/json",
                'location' : 'global'
            },
        }).then(res => {
          console.log(res.data.webPages.value[0].url);
          this.urls.push(res.data.webPages.value[0].url);
        });


        //Creazione card del secondo Quiz
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
        //Le risposte vengono inserite nell'array risposte
        this.risposte.push(step.result);
        //Tramite il servizio di Azure Bing Web Search, viene effettuata una ricerca web 
        //in base alla domanda effettuata, il link nella prima posizione viene inserito nell'array urls
        var url = 'https://api.bing.microsoft.com/v7.0/search?q=' + encodeURIComponent(this.quiz[1].domanda);
        await axios.get(url, {
            headers: {
                'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
                "Accept": "application/json",
                'location' : 'global'
            },
        }).then(res => {
          console.log(res.data.webPages.value[0].url);
          this.urls.push(res.data.webPages.value[0].url);
        });

        //Creazione card del terzo Quiz
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
        //Le risposte vengono inserite nell'array risposte
        this.risposte.push(step.result);
        //Tramite il servizio di Azure Bing Web Search, viene effettuata una ricerca web 
        //in base alla domanda effettuata, il link nella prima posizione viene inserito nell'array urls
        var url = 'https://api.bing.microsoft.com/v7.0/search?q=' + encodeURIComponent(this.quiz[2].domanda);
        await axios.get(url, {
            headers: {
                'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
                "Accept": "application/json",
                'location' : 'global'
            },
        }).then(res => {
          console.log(res.data.webPages.value[0].url);
          this.urls.push(res.data.webPages.value[0].url);
        });


        //Calcolo dei punteggi delle risposte dell'utente
        for(var i = 0; i < 3; i++){
            if(this.risposte[i]==this.quiz[i].rispcorretta) this.punteggio.push(1);
            else this.punteggio.push(0);
        }
        var totale =  this.punteggio[0] + this.punteggio[1] + this.punteggio[2] ;
        
        await step.context.sendActivity(this.datiUtente.nome + " hai totalizzato un punteggio pari a " + totale + ".\nA breve ti invierò un'e-mail con il test corretto.\nRicorda che da ora in poi potrai solo visualizzare le informazioni dell'azienda.");
        
        console.log("Punteggio: " + this.punteggio);
        
        //Inserimento nel database dell'associazione Posizione scelta - Profilo utente
        await conn.query('INSERT INTO "User_Pos"(email,idPosAp) VALUES ' + "('" + this.datiUtente.email + "','" + this.idPosizioneScelta + "');").then(res => {console.log("INSERITA ASSOCIAZIONE POSIZIONE-UTENTE\n" + res);});
        
        //Inserimento nel database dei quiz effettuati dall'utente
        await conn.query('INSERT INTO "User_Quiz"(email,idQuiz,risposta,punteggio) VALUES ' + "('" + this.datiUtente.email + "','" + this.quiz[0].idQuiz + "','" + this.risposte[0] + "','" + this.punteggio[0] + "');").then(res => {console.log("PRIMO QUIZ INSERITO\n" + res);});
        await conn.query('INSERT INTO "User_Quiz"(email,idQuiz,risposta,punteggio) VALUES ' + "('" + this.datiUtente.email + "','" + this.quiz[1].idQuiz + "','" + this.risposte[1] + "','" + this.punteggio[1] + "');").then(res => {console.log("SECONDO QUIZ INSERITO\n" + res);});
        await conn.query('INSERT INTO "User_Quiz"(email,idQuiz,risposta,punteggio) VALUES ' + "('" + this.datiUtente.email + "','" + this.quiz[2].idQuiz + "','" + this.risposte[2] + "','" + this.punteggio[2] + "');").then(res => {console.log("TERZO QUIZ INSERITO\n" + res);});
        
        //Prelievo email del profilo admin
        await conn.query('SELECT * FROM "User" WHERE "User".ruolo = ' + '0').then(result => this.emailadmin = result.recordset[0].email);
        
        
        return await step.next(step);
    }
 
    async mailStep(step){
    
        //Creazione del contenuto dell'e-mail da mandare all'utente e all'admin dove:
        //oggetto: rappresenta l'oggetto dell'e-mail,
        //datiutente, quiz1, quiz2, quiz3: rappresentano il body dell'e-mail

        var oggetto = "Risultati colloquio " + this.datiUtente.cognome + " " + this.datiUtente.nome + "[ " + this.datiUtente.email + " ] - Posizione scelta: " + this.posizione_scelta;

        var datiutente = "\nIl seguente test è stato fatto da " +  this.datiUtente.cognome + " " + this.datiUtente.nome + " per la posizione di " + this.posizione_scelta;

        var quiz1 = "\n\nTEST\nDomanda numero 1: " + this.quiz[0].domanda + "\nRisposta esatta: " + this.quiz[0].rispcorretta + "\nRisposta data: " + this.risposte[0] + "\nPunteggio: " + this.punteggio[0];
        if(!this.punteggio[0]) quiz1 = quiz1 + "\nLink consigliato per l'argomento: " + this.urls[0];
        var quiz2 = "\n\nDomanda numero 2: " + this.quiz[1].domanda + "\nRisposta esatta: " + this.quiz[1].rispcorretta + "\nRisposta data: " + this.risposte[1] + "\nPunteggio: " + this.punteggio[1];
        
        if(!this.punteggio[1]) quiz2 = quiz2 + "\nLink consigliato per l'argomento: " + this.urls[1]; 
        var quiz3 = "\n\nDomanda numero 3: " + this.quiz[2].domanda + "\nRisposta esatta: " + this.quiz[2].rispcorretta + "\nRisposta data: " + this.risposte[2] + "\nPunteggio: " + this.punteggio[2];
        
        if(!this.punteggio[2]) quiz3 = quiz3 + "\nLink consigliato per l'argomento: " + this.urls[2];
        
        const testo = datiutente + quiz1 + quiz2 + quiz3
        console.log(testo);
        
        //Creazione variabile con le caratteristiche dell'e-mail da inviare tramite l'Azure Function
        var url = FUNCTION_ENDPOINT;
            var option = {
                method: 'post',
                url: url,
                data: {
                    email : this.datiUtente.email,
                    emailadmin : this.emailadmin,
                    oggetto: oggetto,
                    testo: testo
                }
            }

        
        const res = await axios(option);

        if (res.status = 200) {
            // Email successfully sent
            await step.context.sendActivity('E-mail inviata con successo!');
        } else {
            // Failed to send the email
            await step.context.sendActivity("C'è stato qualche problema nell'invio dell'e-mail..");
        }
        

        return await step.next(step);

    }

    async prefinalStep(step){

        return await step.prompt(TEXT_PROMPT, 'Vuoi tornare al menù precedente?');

    }

    async finalStep(step){
        clean();
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

function clean(){
    this.quiz = [];
    this.texts = [];
    this.res = null;
    this.emailadmin = null;
    this.buttons = [];
    this.risposte = [];
    this.posizione_scelta = null;
    this.idPosizioneScelta = null;
    this.urls = [];
    this.punteggio = [];
}


module.exports.InterviewDialog = InterviewDialog;
module.exports.INTERVIEW_DIALOG = INTERVIEW_DIALOG;