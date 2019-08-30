import aws from "aws-sdk";

aws.config.update({
  region: "us-east-1",
  // @ts-ignore: this "doesn't exist" in the module declaration
  endpoint: "http://localhost:8000",
  secretAccessKey: "fakeSecret",
  accessKeyId: "fakeId"
})

var dynamodb: aws.DynamoDB = new aws.DynamoDB();

var params: aws.DynamoDB.CreateTableInput = {
  TableName: "stonks",
  KeySchema: [
    {AttributeName: "symbol", KeyType: "HASH"}
  ],
  AttributeDefinitions: [
    {AttributeName: "symbol", AttributeType: "S"}
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5
  }
}

var ttlParams: aws.DynamoDB.UpdateTimeToLiveInput = {
  TableName: "stonks",
  TimeToLiveSpecification: {
    AttributeName: "expiry",
    Enabled: true
  }
}

dynamodb.deleteTable({TableName: "stonks"}, (err, data) => {
  if (err) {
    console.error(err);
  } else {
    console.log(data);
  };


dynamodb.createTable(params, (err, data) => {
  if (err) {
    console.error(err);
  } else {
    console.log(data);
    dynamodb.updateTimeToLive(ttlParams,(err, data) => {
      if (err) {
        console.error(err);
      } else {
        console.log(data);
      }
    })
  }
});}
);
