require('dotenv').config();

var contentful = require('contentful');
var exec = require('child_process').exec;

var client = contentful.createClient({
  space: process.env.space_id,
  accessToken: process.env.access_token
});

function execMe(cmd, name) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      console.log(stdout);
      console.log(stderr);
    });
    setTimeout(function() {
      resolve(true);
    }, 2000);
  });
}

client.getContentTypes().then(contentTypes => {
  const generateMigrations = async () => {
    for (const contentType of contentTypes.items) {
      let contentTypeId = contentType.sys.id;
      await execMe(
        `contentful space generate migration --space-id ${
          process.env.space_id
        } --environment-id master --content-type-id ${contentTypeId} --filename migrations/${contentTypeId}.js`,
        contentTypeId
      );
    }
  };
  generateMigrations();
});
