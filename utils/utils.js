exports.isEmpty = (str) => {
  if (str.trim() === "") return true;
  else return false;
};

exports.isEmail = (email) => {
  const emailRegEx =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

  if (email.match(emailRegEx)) return true;
  else return false;
};

exports.reduceUserDetails = (data) => {
  let userDetails = {};

  if (!this.isEmpty(data.bio.trim())) {
    userDetails.bio = data.bio;
  }

  if (!this.isEmpty(data.location.trim())) {
    userDetails.location = data.location;
  }

  if (!this.isEmpty(data.website.trim())) {
    if (data.website.trim().substr(0, 4) !== "http") {
      userDetails.website = `http://${data.website.trim()}`;
    } else {
      userDetails.website = data.website;
    }
  }

  return userDetails;
};
