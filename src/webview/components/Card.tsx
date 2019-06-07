
import * as React from 'react';

const Card = ({cardList}) => (
    <>
      {cardList.map(list => (
        <div className="card">
          <div className="row">
            <div className="bg-teal-dark">
              <span>
                <span className="card-heading">{list.heading}</span>
                <hr></hr>
                <h4>{list.headingIntro}</h4>
              </span>
            </div>
          </div>
          <div className="row" style= {{ height: 280 }}>
            <div className="card-body">
              <span>
                <p><img src={list.url} alt={list.urlAlt} style={{ height: 45 }}></img></p>
                  <React.Fragment>
                  <p> {list.description} </p>
                  </React.Fragment>
              </span>
            </div>
          </div>
          <div className="row" style={{ marginBottom: 30}}>
            <div><a href={list.redirectLink} className="button-text">{list.buttonText}</a>
            </div>
          </div>
        </div>
      ))}
    </>
  );

export default Card;
