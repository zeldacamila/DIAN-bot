require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');
const axios = require('axios').default;
const fs = require('fs');
const path = require('path');

const app = express();
app.disable('x-powered-by');
app.use(express.json());

const PORT = process.env.PORT || 3000;
const ID = process.env.ID;
const RL_ID = process.env.RL_ID;
const NIT = process.env.NIT;

// Middleware para verificar la clave de API
const verifyAPIKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey && apiKey === process.env.API_KEY) {
        next();
    } else {
        res.status(401).json({message: 'Acceso no autorizado.'});
    }
};

// Rutas protegidas con Middleware verifyAPIKey
// Ruta: Envío de token a correo
app.get('/requestToken', verifyAPIKey, async (req, res) => {
    if (!RL_ID) {
        return res.status(400).send('Se requiere un ID');
    }
    // Iniciar Puppeteer
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    // Navegar a la página de inicio de sesión de personas
    await page.goto('https://catalogo-vpfe.dian.gov.co/User/CompanyLogin');
    // Hacer click en 'Representante Legal'
    await page.click('#legalRepresentative')
    // Esperar a que el formulario de inicio de sesión sea visible
    await page.waitForSelector('form[method="post"]', { visible: true });
    // Seleccionar el tipo de identificación
    // Asumiendo que el ID del selector es "PersonIdentificationType" basado en el HTML de la página
    await page.select('#CompanyIdentificationType', '10910094'); // '10910094' corresponde a 'Cédula de ciudadanía'
    // Introducir el número de cédula en el campo correspondiente
    // Asumiendo que el id del campo es "UserCode" basado en el HTML de la página
    await page.type('#UserCode', `${RL_ID}`, { delay: 100 });
    // Introducir el número de NIT en el campo correspondiente
    // Asumiendo que el id del campo es "CompanyCode" basado en el HTML de la página
    await page.type('#CompanyCode', `${NIT}`, { delay: 100 });
    // Hacer clic en el botón de enviar el formulario
    await page.click('button.btn.btn-primary');

    // Cierra el navegador y envía una respuesta
    // await browser.close();
    res.json({message: 'Token solicitado'});
});

// Ruta: Obtener token, acceder y generar excel
app.post('/generateZip', verifyAPIKey, async (req, res) => {
    const { token } = req.body; // Extraer el token del cuerpo de la solicitud
    try {
        // Lanza un navegador
        const browser = await puppeteer.launch({headless:false});
        const page = await browser.newPage();
        console.log('se abre pagina en blanco')
        // Acceder a la URL proporcionada
        await page.goto(`${token}`);
        const content = await page.content();
        // Accede a Descarga de listados
        await page.goto('https://catalogo-vpfe.dian.gov.co/Document/Export', { waitUntil: 'networkidle0' }); // Esperar a que la red esté inactiva
        console.log('Accede a Descarga de listados')
        // Click en "Exportar Excel"
        await page.waitForSelector('button.btn-export-excel', {visible: true});
        await page.click('button.btn-export-excel');
        console.log('Click en Exportar Excel')
        const content2 = await page.content();
        console.log('Se abre modal')
        //console.log(content2);
        // Click en "SI" en el modal
        await page.evaluate(() => {
            document.querySelector("#confirmModal-confirm-button").click();
        })
        console.log('SÍ (modal)')
        
        // Cierra el navegador
        //await browser.close();  
        res.json({message:'Excel generado con éxito'}); // Enviar una respuesta al cliente
    } catch (error) {
        console.error(error);
            // Cierra el navegador en caso de error para no dejar procesos abiertos
            if (browser !== undefined) await browser.close();
        res.status(500).json({message: 'Error al procesar la solicitud'})
    }
});

// Ruta: Acceder y descargar Zip
app.post('/downloadZip', verifyAPIKey, async (req, res) => {
    const { token } = req.body;
    let browser; // Declara browser aquí para que sea accesible en el bloque catch
    try {
        // Lanza un navegador
        browser = await puppeteer.launch({headless:false});
        const page = await browser.newPage();
        console.log('se abre pagina en blanco');
        // Acceder a la URL proporcionada
        await page.goto(`${token}`);
        await page.goto('https://catalogo-vpfe.dian.gov.co/Document/Export', { waitUntil: 'networkidle0' });
        console.log('Accede a Descarga de listados después de generar excel');
        await page.waitForSelector('#tableExport > tbody > tr:nth-child(1) > td:nth-child(8) > a > i', {visible: true});
        const content = await page.content();
        
        // Utiliza una expresión regular para encontrar el enlace de descarga en el contenido HTML
        const hrefRegex = /href="\/(Document\/DownloadExportedZipFile\?pk=[^"]*)"/;
        const matches = content.match(hrefRegex);
        let cleanDownloadLink = '';
        if (matches && matches[1]) {
            // Asegúrate de que esto construye correctamente la URL completa
            const downloadLink = `https://catalogo-vpfe.dian.gov.co/${matches[1]}`;
            // Limpia la URL eliminando 'amp;'
            cleanDownloadLink = downloadLink.replace(/amp;/g, '');
            console.log('Extrae Download Link:', cleanDownloadLink);
            
        } else {
            console.log('Download link not found');
            throw new Error('Download link not found');
        }
        await page.goto(cleanDownloadLink);
        await page.content();
        console.log('125---')
        // Cierra el navegador
        //await browser.close();
        res.json({message:'Zip descargado con éxito'});
    } catch (error) {
        console.error(error);
        res.status(500).json({message: 'Error al procesar la solicitud'});
    }
});

/* app.post('/downloadZip2', verifyAPIKey, async (req, res) => {
    const { downloadLink } = req.body; // Asume que `downloadLink` es la URL completa del archivo

    try {
        const response = await axios({
            method: 'GET',
            url: downloadLink,
            responseType: 'stream'
        });

        const pathToFile = path.resolve(__dirname, 'downloads', 'archivo.zip');
        fs.writeFileSync(pathToFile, response.data);

        res.json({message: 'Archivo .zip descargado con éxito', path: pathToFile});
    } catch (error) {
        console.error(error);
        res.status(500).json({message: 'Error al realizar la petición GET'});
    }
});
 */
app.get('/obtenerToken', verifyAPIKey, async (req, res) => {
    if (!ID) {
        return res.status(400).send('Se requiere un ID');
    }
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto('https://catalogo-vpfe-hab.dian.gov.co/User/PersonLogin');
    await page.waitForSelector('form[method="post"]', { visible: true });
    await page.select('#PersonIdentificationType', '10910094'); 
    await page.type('#PersonCode', `${ID}`, { delay: 100 })
    await page.click('button.btn.btn-primary');
    await browser.close();
    res.json({message: 'Token solicitado'});
});

app.get('/', (req, res) => {
    res.json({message: 'Hello world!'});
});

// Manejador de ruta 404
app.use((req, res) => {
    res.status(404).json({message: '404 Not Found'});
});

app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`);
});