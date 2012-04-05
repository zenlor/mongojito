var Mongojito = require('../lib/mongojito');

Mongojito.connect(['mongo://localhost:27017/test']);

var Post = Mongojito.bake('post');


var post = new Post({
  title: 'a title'
, text: 'lorem ipsum ...'
});

post.save(function(err){
  if (err) throw err;

  Post.find(function(err, data){
    if (err) throw err;

    console.log(data);
    process.exit(0);
  });
})
