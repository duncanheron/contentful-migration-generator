require('dotenv').config();

var contentful = require('contentful');
var exec = require('child_process').exec;

var client = contentful.createClient({
  space: process.env.space_id,
  accessToken: process.env.access_token,
  environment: process.env.space_env
});

function execMe(cmd, name) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.log(err);
        process.exit(-1);
      }
      console.log(stdout);
    });
    setTimeout(function() {
      resolve(true);
    }, 2000);
  });
}

client
  .getContentTypes()
  .then(async contentTypes => {
    const generateMigrations = async () => {
      console.log('=====Generating content model migrations=====');
      for (const contentType of contentTypes.items) {
        let contentTypeId = contentType.sys.id;
        try {
          await execMe(
            `contentful space generate migration --space-id ${
              process.env.space_id
            } --environment-id ${
              process.env.space_env
            } --content-type-id ${contentTypeId} --filename migrations/${contentTypeId}-${
              process.env.space_env
            }.js`,
            contentTypeId
          );
        } catch (err) {
          throw err;
          process.exit(-1);
        }
      }
    };
    const generateContentExport = async () => {
      console.log('=====Generating content export=====');
      await execMe(
        `contentful space export --space-id ${process.env.space_id} --environment-id ${
          process.env.space_env
        } --content-file ${
          process.env.space_env
        }-content-export.json --export-dir content_export/ --use-verbose-renderer`
      );
    };
    function wait(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
    try {
      await generateMigrations();
      await wait(3000);
      await generateContentExport();
    } catch (err) {
      process.exit(-1);
    }
  })
  .catch(err => {
    process.exit(1);
  });
