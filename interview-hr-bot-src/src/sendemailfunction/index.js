const nodemailer = require('nodemailer');

module.exports = async function (context, req) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'humanresourcespetrazsoftware@gmail.com', // your GMail email address 
            pass: 'petrazpetraz' // your Gmail password
        }
    });

    const email = (req.query.email || (req.body && req.body.email));
    const emailAdmin = (req.query.emailadmin || (req.body && req.body.emailadmin));
    const subject = (req.query.oggetto || (req.body && req.body.oggetto));
    const object = (req.query.testo || (req.body && req.body.testo));

    const mailOptions = {
        from: 'humanresourcespetrazsoftware@gmail.com', // your GMail email address 
        to: email, // destination email address 
        subject: subject,
        text: object
    };

    const mailOptionsAdmin = {
        from: 'humanresourcespetrazsoftware@gmail.com', // your GMail email address 
        to: emailAdmin, // destination email address 
        subject: subject,
        text: object
    };
    
    let success;
    let successadmin;

    try {
        success = await transporter.sendMail(mailOptions);
        successadmin = await transporter.sendMail(mailOptionsAdmin);        
    } catch (err) {
        context.log(err);
        success = false;
    }

    if (success&&successadmin) {
        await context.log('e-mail inviate con successo');
    } else {
        await context.log("errore nell'invio delle mail");
    }
}