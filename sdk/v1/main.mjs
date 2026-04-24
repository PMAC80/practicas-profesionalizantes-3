import { DatabaseError } from 'sequelize';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { URL } from 'node:url';
import  sqlite3  from 'sqlite3';

//-------------------------------------------------------------------------------
// trabajo con el config.json
//-------------------------------------------------------------------------------

function default_config() 
{
    const config = 
      {
          server: 
          {
              ip: '127.0.0.1',
              port: 3000,
              default_path: './default.html'
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

let config = load_config();

//-------------------------------------------------------------------------------
// trabajo con base de datos
//-------------------------------------------------------------------------------

function connect_db( path ) 
{
  const dbPath = resolve(path);

  const db = new sqlite3.Database(dbPath, (err) => 
    {
    if (err) 
      {
      throw new Error(`Error al conectar a la base de datos: ${err.message}`);
      }
    });

  return db;
}

const db = connect_db( config.database.path );


export function insertarUsuario(db) 
{
  const sql = `
    INSERT INTO user (username, password)
    VALUES (?, ?)
  `;

  const username = 'usuario_demo';
  const password = 'password123';

  return new Promise((resolve, reject) => 
    {
      db.run(sql, [username, password], function (err) {
        if (err) 
          {
          reject(err);
          return;
          }

        resolve({
        id: this.lastID,
        username,
        password
        });
      });
    });
}

insertarUsuario(db)
  .then((resultado) => 
    {
    console.log('Usuario insertado:', resultado);
    })
  .catch((error) => 
    {
    console.error('Error al insertar:', error.message);
    });

//-------------------------------------------------------------------------------
// logica de negocio
//-------------------------------------------------------------------------------

function login( input )
{
	const userdata =
	{
		username: 'admin',
		password: '1234'
	};

	let output =
	{
		status: false,
		result: null,
		description: 'INVALID_USER_PASS'
	};

	
	if ( input.username === userdata.username && input.password === userdata.password )
    {
      output.status = true;
      output.result = input.username;
      output.description = null;
    }

	return output;
}

function register( username, password )
{
	const sql = `INSERT INTO user (username, password) VALUES (?, ?)`;

	return new Promise((resolve, reject) => 
  { 
		db.run(sql, [username, password], function (err) {
			if (err) 
        {
				resolve({ status: false, description: err.message });
			  } 
      else 
        {
				resolve({ status: true, result: username, description: 'Usuario registrado con éxito' });
		  	}
		});
	});
}

async function login_handler(request, response)
{
    const url = new URL(request.url, 'http://' + config.server.ip);
    const input = Object.fromEntries(url.searchParams);

    console.log(input);

    const output = login(input);

    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(output));
}

function default_handler(request, response)
{
	try 
	  {
        const html = readFileSync(config.server.default_path, 'utf-8');
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end(html);
    } 
  catch (error) 
    {
        response.writeHead(500);
        response.end('Error interno: No se pudo cargar la vista principal.');
    }
}

function register_handler(request, response)
{
	if (request.method === 'POST') 
    {
      let body = '';

      request.on('data', chunk => 
      {
        body += chunk.toString();
      });

      request.on('end', async () => 
      {
        const inputParams = new URLSearchParams(body);
        const input = Object.fromEntries(inputParams);

        const output = await register(input.username, input.password);

        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(output));
      });
    } 
	else 
    {
      response.writeHead(405);
      response.end('Método no permitido. Utilice POST.');
    }
}

let router = new Map();
router.set('/', default_handler )
router.set('/login', login_handler );
router.set('/register', register_handler );


async function request_dispatcher(request, response)
{
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
//-------------------------------------------------------------------------------
//iniciar el servidor
//-------------------------------------------------------------------------------

function start()
{
	console.log(`Servidor ejecutándose en http://${config.server.ip}:${config.server.port}`);
}

let server = createServer(request_dispatcher);

server.listen(config.server.port, config.server.ip, start);