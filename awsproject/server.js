/* Include Necessary Modules */
var express = require('express');
var path = require('path');  
var bodyParser = require("body-parser");          
const { response } = require('express');
var AWS = require("aws-sdk");
var fs = require('fs');
const app = express();
const port = 3000;

const bucket = "csu44000assign2useast20"
const key = "moviedata.json"
const S3 = new AWS.S3();



exports.handler = async (event, context, callback) => {
    var transcript = await download();
    console.log(transcript);
}


/* run express server on port 3000 */
app.listen(port, () => {
    console.log(`Server running at http://localhost:3000/`);
  });


AWS.config.update({
    region: "us-east-1",
    endpoint: "http://localhost:8000"
});


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
        // check for errors
        if (err) {
            console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
        } else {
            console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
        }
    });
    
    // load data into created db
    load_data();
})

// load data into database
function load_data(){
    var docClient = new AWS.DynamoDB.DocumentClient();

    console.log("Importing movies into DynamoDB. Please wait.");

    // set key and bucket details
    const data_options = 
        {   
            Bucket: bucket, 
            Key: key,
        };

    // retrieve JSON from bucket
    S3.getObject(data_options, (error,data) => {
            if(error){
                console.log("error" + error);
            }
            else{
                //response.send(data);
                const moviedata = JSON.parse((data.Body).toString());
                console.log(moviedata);

                // add movies to table
                var allMovies = moviedata;
                allMovies.forEach(function(movie) {
                    var params = {
                        TableName: "Movies",
                        Item: {
                            "year":  movie.year,
                            "title": movie.title,
                            "release_date":  movie.info.release_date,
                            "rank": movie.info.rank
                        }
                    };

                    docClient.put(params, function(err, moviedata) {
                    if (err) {
                        console.error("Unable to add movie", movie.title, ". Error JSON:", JSON.stringify(err, null, 2));
                    } else {
                        console.log("PutItem succeeded:", movie.title);
                    }
                
                });
            });

            }
        
    });
        
    //body: JSON.stringify(data);
    //console.log(body);
}

//app.post('/query', queryTable);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:false}))

app.post('/query',(req, res) => {

    var docClient = new AWS.DynamoDB.DocumentClient();
    console.log(req.body)
    let name = req.body.name;
    let year = parseInt(req.body.year);
    

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

    docClient.query(params, function(err, data) {
    if (err) {
        console.error("Unable to query. Error:", JSON.stringify(err, null, 2));
    } else {
        console.log("Query succeeded.");
        data.Items.forEach(function(item) {
            console.log(" -", item.year + ": " + item.title + "rank:" + item.rank + "release date:" + item.release_date);
        });

        res.json({
            data : data.Items
        })
        
    }
    
    });
})

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

    res.json();

})


