import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { URL } from 'node:url';
import crypto from 'node:crypto';

function default_config() 
{
    const config = 
    {
        server: 
        {
            ip: '127.0.0.1',
            port: 3000,
            default_path: './index.html'
        },
        database: 
        {
            path: './database.db'
        }
    };

    return config;
}

function load_config() 
{
    let config = null;
    try 
    {
        const data = readFileSync('./config.json', 'utf-8');
        config = JSON.parse(data);
        console.log("Configuración cargada correctamente.");
    } 
    catch (error) 
    {
        console.error("Error cargando config.json. Usando valores por defecto.");
        config = default_config();
    }
    return config;
}

const config = load_config();

function connect_db(path) 
{
    const dbPath = resolve(path);
    try 
    {
        const db = new DatabaseSync(dbPath);
        return db;
    } 
    catch (err) 
    {
        throw new Error("Error al conectar a la base de datos: " + err.message);
    }
}


let userSessions = new Map();  //clave-valor  -> clave: id_user,  valor: sessionObj

class UserSession
{
    constructor()
    {
       this.status = 'disabled';
    }

}

function hashPassword(password)
{
    return crypto
        .createHash('sha256')
        .update(password)
        .digest('hex');
}


function authenticate( username, password )
{
    console.log("AUTH:", username, password);
    const sql = "SELECT count(*) as total FROM `user` WHERE username=? AND password=?";

    try 
    {
        const passwordHash = hashPassword(password);

        const stmt = db.prepare(sql);
        const row = stmt.get(username, passwordHash);            
        return (row.total === 1);
    } 
    catch (err) 
    {
        throw err;
    }
}


function authorize( username, endpointPath )
{
    const sql = `
        SELECT count(*) as total
        FROM access a
        JOIN members m ON a.id_group = m.id_group
        JOIN user u ON m.id_user = u.id
        JOIN endpoint e ON a.id_endpoint = e.id
        WHERE u.username = ? 
          AND e.path = ?
    `;

    try {
        const stmt = db.prepare(sql);
        // Pasamos los parámetros en el orden de los signos de interrogación
        const row = stmt.get(username, endpointPath);
        console.log(row);
        // Si el conteo es mayor a 0, tiene permiso
        return row.total > 0;
    } catch (err) {
        console.error("Error consultando permisos:", err);
        throw err;
    }
}

function login( username, password )
{
    console.log(username, password);
    let isAuthenticated = authenticate(username, password);

    if ( isAuthenticated )
    {
    let havePreviousSession = userSessions.get(username);

    if ( havePreviousSession == null )
        {
            let newSession = new UserSession();
            newSession.status = 'enabled';

            userSessions.set(username, newSession);

            return newSession;
        }
    else
        {
            if ( havePreviousSession.status == 'disabled' )
            {
                havePreviousSession.status = 'enabled';
            }

            return havePreviousSession;
        }    }
        else
        {
            return null;
        }

    //El retorno de esta función está representando si se devuelve o no un objeto de sesión.
}

function logout(username, password)
{
    let isAuthenticated = authenticate(username, password);

    if ( isAuthenticated )
    {
        let currentSession = userSessions.get(username);
        currentSession.status = 'disabled';
    }
}

// Lógica de negocio
async function createUser(db, username, password) 
{
    const sql = "INSERT INTO user (username, password) VALUES (?, ?) RETURNING id";

    try 
    {
        const passwordHash = hashPassword(password);

        const stmt = db.prepare(sql);
        const row = stmt.get(username, passwordHash);
        const result =
        {
            id: row.id,
            username: username
        };        
        return result;
    } 
    catch (err) 
    {
        throw err;
    }
}

const db = connect_db(config.database.path);
//const output = await createUser(db, 'test', '123456789');



// Manejadores
async function login_handler(request, response)
{
    const url = new URL(request.url, 'http://' + config.server.ip);
    
    if ( request.method == "POST" )
    {
        let body = '';
        request.on('data', chunk => {
            body += chunk.toString();
        });

        request.on('end', async () =>
        {
            try
            {
                // Leer credenciales desde headers HTTP
                const username = request.headers["x-user-id"];
                const apiKey = request.headers["x-api-key"];
                
                const output = login(username, apiKey);
                response.writeHead(200, { 'Content-Type': 'application/json' });
                console.log("OUTPUT:", output);
                response.end(JSON.stringify(output));
            } 
            catch (err) 
            {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'Formato JSON inválido' }));
            }
        });
    }
    else
    {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'Método no permitido. Usa POST.' }));
        return;
    }
  
    
}

async function register_handler(request, response)
{
    let body = '';
    
    request.on('data', chunk => {
        body += chunk.toString();
    });
    
    request.on('end', async () => {
        // Parsear datos del formulario (application/x-www-form-urlencoded)
        const params = new URLSearchParams(body);
        const username = params.get('username');
        const password = params.get('password');
        
        try 
        {
            const output = await createUser(db, username, password);
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(output));
        }
        catch (err)
        {
            response.writeHead(500);
            response.end(JSON.stringify({ error: err.message }));
        }
    });
}

function show_message_handler(request, response)
{
    console.log("Petición recibida: Mostrando mensaje en el servidor!");
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ message: "Mensaje procesado" }));
}

function print_handler(request, response)
{
    const permitido = authorize(request.headers["x-user-id"], "print");
    if (permitido)
    {
        console.log("PRINT permitido");
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: true, message: "PRINT permitido" }));
    }
    else
    {
        console.log("PRINT denegado");
        response.writeHead(401, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: false, message: "PRINT denegado" }));
    }
}

function log_handler(request, response)
{
    const permitido = authorize(request.headers["x-user-id"], "log");
    if (permitido)
    {
        console.log("LOG permitido");
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: true, message: "LOG permitido" }));
    }
    else
    {
    console.log("PRINT denegado");
    response.writeHead(401, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ 
        exception: "Unauthorized", 
        detail: ["Acceso denegado al endpoint"] 
}));
    }
}

function help_handler(request, response)
{
    const permitido = authorize(request.headers["x-user-id"], "help");
    if (permitido)
    {
        console.log("HELP permitido");
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: true, message: "HELP permitido" }));
    }
    else
    {
    console.log("PRINT denegado");
    response.writeHead(401, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ 
        exception: "Unauthorized", 
        detail: ["Acceso denegado al endpoint"] 
}));    }
}

function sayHello_handler(request, response)
{
    const permitido = authorize(request.headers["x-user-id"], "sayHello");
    if (permitido)
    {
        console.log("SAYHELLO permitido");
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: true, message: "SAYHELLO permitido" }));
    }
    else
    {
        console.log("PRINT denegado");
    response.writeHead(401, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ 
    exception: "Unauthorized", 
    detail: ["Acceso denegado al endpoint"] 
}));
    }
}

function sayBye_handler(request, response)
{
    const permitido = authorize(request.headers["x-user-id"], "sayBye");
    if (permitido)
    {
        console.log("SAYBYE permitido");
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: true, message: "SAYBYE permitido" }));
    }
    else
    {
    console.log("PRINT denegado");
    response.writeHead(401, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ 
        exception: "Unauthorized", 
        detail: ["Acceso denegado al endpoint"] 
}));    }
}

// Ruteo
let router = new Map();
router.set('/login', login_handler);
router.set('/register', register_handler);

router.set('/showMessage', show_message_handler);

router.set('/print', print_handler);
router.set('/log', log_handler);
router.set('/help', help_handler);
router.set('/sayHello', sayHello_handler);
router.set('/sayBye', sayBye_handler);

async function request_dispatcher(request, response)
{
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id, x-api-key');    
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('X-API-Version', '1.0');
    
    if (request.method === 'OPTIONS')
    {
        response.writeHead(204);
        response.end();
        return;
    }

    const url = new URL(request.url, 'http://' + config.server.ip);
    const path = url.pathname;
    const handler = router.get(path);

    if (handler)
    {
        return await handler(request, response);
    }
    else
    {
        response.writeHead(404);
        response.end('Método no encontrado');
    }
}

function start()
{
    console.log('Servidor ejecutándose en http://' + config.server.ip + ':' + config.server.port);
}

let server = createServer(request_dispatcher);
server.listen(config.server.port, config.server.ip, start);