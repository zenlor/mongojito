var Mongojito = require('../lib/mongojito')
  , async = require('async')
  ;
require('should');

Mongojito.connect(['mongo://127.0.0.1:27017/mongojito']);
//Mongojito.cache(['127.0.0.1:11211'])


var Post = Mongojito.bake('posts');

describe('Mongojito', function() {
  before(function(){
    Mongojito.DB.collection('posts').drop();
  });


  describe('creating new record', function() {
    it('should create new record in "posts" collection', function(done) {
      var post = new Post;
      post.title = 'Very nice post!';
      post.author = 'Vadim';
      
      post.save(function() {
        Post.find(function(err, posts) {
          posts.length.should.equal(1);
          done();
        });
      });
    });
  });

  describe('editing record', function() {
    it('should save edited version of the post', function(done) {
      Post.find(function(err, posts) {
        var post = posts[0];
        post.title = 'Edited title!';
        post.save(function() {
          done();
        });
      });
    });
  });

  describe('getting record', function() {
    it('should fetch just edited post', function(done) {
      Post.find(function(err, posts) {
        posts[0].title.should.equal('Edited title!');
        done();
      });
    });
  });

  describe('fetching records', function() {

    it('should fetch only one post', function(done) {
      Post.find({
        limit: 1
      }, function(err, posts) {
        posts.length.should.equal(1);
        done();
      });
    });

    it('should fetch post by title', function(done) {
      Post.find({ title: 'Edited title!' }, function(err, posts) {
        posts.length.should.equal(1);
        done();
      });
    });

    it('should create another post and fetch only one', function(done) {
      var post = new Post;
      post.title = 'Just created';
      post.author = 'Vadim';
      
      post.save(function() {
        Post.find({
          limit: 1,
          skip: 1
        }, function(err, posts) {
          posts.length.should.equal(1);
          done();
        });
      });
    });
    
    it('should fetch posts, ordering by the time of creation', function(done) {
      Post.find({
        sort: {
          _id: -1
        }
      }, function(err, posts) {
        posts[0].title === 'Just created' && posts.length.should.equal(2);
        done();
      });
    });
  });
  
  describe('deleting records', function() {
    it('should remove all posts', function(done) {
      Post.find(function(err, posts) {
        async.forEach(posts, function(post, nextPost) {
          post.remove(function() {
            nextPost();
          });
        }, function() {
          Post.find(function(err, posts) {
            posts.length.should.equal(0);
            done();
          });
        });
      });
    });
  });

});