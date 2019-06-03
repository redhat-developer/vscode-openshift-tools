
import * as React from 'react';

interface CardProps {
  heading: string;
  headingIntro: string;
  description: React.ReactFragment;
  url: string;
  urlAlt: string;
  redirectLink: string;
  buttonText: string;
}

const Card = (props: CardProps) => {

  return (
    <div className="card">
      <div className="row">
        <div className="bg-teal-dark">
          <span>
            <span className="card-heading">{props.heading}</span>
            <hr></hr>
            <h4>{props.headingIntro}</h4>
          </span>
        </div>
      </div>
      <div className="row" style= {{ height: 250 }}>
        <div className="px-lg-4">
          <span>
            <p className="pb-1"><img src={props.url} alt={props.urlAlt} className="img-fluid" style={{ height: 45 }}></img></p>
            <p>{props.description}</p>
          </span>
        </div>
      </div>
      <div className="row" style={{ marginBottom: 15}}>
        <div>
          <p><a href={props.redirectLink} className="button-text">{props.buttonText}</a></p>
        </div>
      </div>
    </div>
  );
};

export default Card;
