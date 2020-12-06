/* Include Necessary Modules */
var express = require('express');
var path = require('path');  
var bodyParser = require("body-parser");          
var AWS = require("aws-sdk");
/* Constants */
const app = express();                      // framework for API 
const port = 3000;                          // port number
const bucket = "csu44000assign2useast20"    // bucket with movie json
const key = "moviedata.json"                // key for bucket
const S3 = new AWS.S3();                    // create aws object

// transcript of table creation
exports.handler = async (event, context, callback) => {
    var transcript = await download();
    console.log(transcript);
}

/* run express server on port 3000 */
app.listen(port, () => {
    console.log(`Server running at http://localhost:3000/`);
  });

// connect to dyanamo server
AWS.config.update({
    region: "us-east-1",
});

// display vue index
app.get('/', (req, res) => res.sendFile(path.join(__dirname + '/public/index.html')));

// create movie table & loading data into it
app.post('/newtable', (req, res) => {

        // create dynamo object
        var dynamodb = new AWS.DynamoDB();

        // set parameters
        var params = {
            TableName : "Movies",
            KeySchema: [       
                { AttributeName: "year", KeyType: "HASH"},    // Partition key
                { AttributeName: "title", KeyType: "RANGE" }  // Sort key
            ],
            AttributeDefinitions: [       
                { AttributeName: "year", AttributeType: "N" },
                { AttributeName: "title", AttributeType: "S" }
            ],
            ProvisionedThroughput: {       
                ReadCapacityUnits: 5, 
                WriteCapacityUnits: 5
            }
    };

    // create table with parameters
    dynamodb.createTable(params, function(err, data) {
        console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
    });
    
    // call function to load movie json data into table
    load_data();
})

// load movie json data into database
function load_data(){
    var docClient = new AWS.DynamoDB.DocumentClient();              // create client
    console.log("Importing movies into DynamoDB. Please wait.");

    // set key and bucket details
    const data_options = 
        {   
            Bucket: bucket, 
            Key: key,
        };

    // retrieve JSON from bucket
    S3.getObject(data_options, (error,data) => {

            const moviedata = JSON.parse((data.Body).toString());       // parse json
            console.log(moviedata);

            var allMovies = moviedata;
            // for each movie in json add it to the talbe
            allMovies.forEach(function(movie) {
                // add movie title, year, release date and rank to Movies table
                var params = {
                    TableName: "Movies",
                    Item: {
                        "year":  movie.year,
                        "title": movie.title,
                        "release_date":  movie.info.release_date,
                        "rank": movie.info.rank
                    }
                };
                // put movie data into client
                docClient.put(params, function(err, moviedata) {
                    console.log("PutItem succeeded:", movie.title);
                });
         });
    });
}

// extensions to read json and spaces
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:false}))

// endpoint for querying on front end
app.post('/query',(req, res) => {

    var docClient = new AWS.DynamoDB.DocumentClient();      // create client
    let name = req.body.name;               // movie name
    let year = parseInt(req.body.year);     // movie year
    
    // params for querying table
    var params = {
        TableName : "Movies",
        ProjectionExpression:"#yr, title, #rk, release_date",
        KeyConditionExpression: "#yr = :yyyy and begins_with(title, :movie_title)",
        ExpressionAttributeNames:{
            "#yr": "year",
            "#rk": "rank"
        },
        ExpressionAttributeValues: {
            ":yyyy": year,
            ":movie_title": name
        }
    };
    // query data in table
    docClient.query(params, function(err, data) {
    if (err) {
        console.error("Unable to query. Error:", JSON.stringify(err, null, 2));
    } else {
        console.log("Query succeeded.");
        data.Items.forEach(function(item) {
            console.log(" -", item.year + ": " + item.title + "rank:" + item.rank + "release date:" + item.release_date);
        });
            // return data from dyanamo query
            res.json({
                data : data.Items
            })      
        }    
    });
})

// delete table endpoint
app.post('/table', (req, res) => {

    var dynamodb = new AWS.DynamoDB();

    var params = {
        TableName : "Movies"
    };
    
    dynamodb.deleteTable(params, function(err, data) {
        if (err) {
            console.error("Unable to delete table. Error JSON:", JSON.stringify(err, null, 2));
        } else {
            console.log("Deleted table. Table description JSON:", JSON.stringify(data, null, 2));
            res.send();
        }
    });

    res.json();     // return   
})


