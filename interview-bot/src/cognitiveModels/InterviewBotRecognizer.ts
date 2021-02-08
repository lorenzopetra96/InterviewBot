import { RecognizerResult, TurnContext } from 'botbuilder';
import { LuisApplication, LuisRecognizer, LuisRecognizerOptionsV3 } from 'botbuilder-ai';

export class InterviewBotRecognizer {
    private recognizer: LuisRecognizer;

    constructor(config: LuisApplication) {
        const luisIsConfigured = config && config.applicationId && config.endpoint && config.endpointKey;
        if (luisIsConfigured) {
            // Set the recognizer options depending on which endpoint version you want to use e.g LuisRecognizerOptionsV2 or LuisRecognizerOptionsV3.
            // More details can be found in https://docs.microsoft.com/en-gb/azure/cognitive-services/luis/luis-migration-api-v3
            const recognizerOptions: LuisRecognizerOptionsV3 = {
                apiVersion : 'v3'
            };

            this.recognizer = new LuisRecognizer(config, recognizerOptions);
        }
    }

    public get isConfigured(): boolean {
        return (this.recognizer !== undefined);
    }

    /**
     * Returns an object with preformatted LUIS results for the bot's dialogs to consume.
     * @param {TurnContext} context
     */
    public async executeLuisQuery(context): Promise<RecognizerResult> {
        return this.recognizer.recognize(context);
    }
}