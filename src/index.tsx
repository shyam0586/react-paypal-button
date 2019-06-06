import '@babel/polyfill'
import React from 'react';
import ReactDOM from 'react-dom';
import paypal from 'paypal-checkout';

const Button = paypal.Button.driver('react', { React, ReactDOM });

/**
 * types
 */
interface State {
  loaded: boolean;
  error: boolean;
}

export type OnCancelData = {
  billingID: string;
  cancelUrl: string;
  intent: string;
  paymentID: string;
  paymentToken: string;
}

export type OnShippingChangeData = {
  amount: {
    value: string,
    currency_code: string,
    breakdown: {}
  },
  orderID: string;
  paymentID: string;
  paymentToken: string;
  shipping_address: {
    city: string;
    country_code: string;
    postal_code: string;
    state: string;
  }
}

export type PayPalPaymentData = {
  cart: string;
  create_time: string;
  id: string;
  intent: 'sale' | 'purchase';
  payer: {
    payer_info: {
      country_code: string;
      email: string;
      first_name: string;
      last_name: string;
      middle_name: string;
      payer_id: string;
      shipping_address: {
        city: string;
        country_code: string;
        line1: string;
        postal_code: string
        recipient_name: string;
        state: string;
      }
    };
    payment_method: string;
    status: 'UNVERIFIED' | 'VERIFIED';
  };
  state: string;
  transaction: any[];
}


type OnShippingChangeReturnType = Promise<number | void> | number | void;

export type PayPalButtonProps = {
  env: 'sandbox' | 'production';
  sandboxID?: string;
  productionID?: string;
  amount: number;
  currency: string;
  onPaymentStart?: () => void;
  onPaymentSuccess?: (response: PayPalPaymentData) => void;
  onPaymentError?: (msg: string) => void;
  onPaymentCancel?: (data: OnCancelData) => void;
  onShippingChange?: (data: OnShippingChangeData) => OnShippingChangeReturnType;
}

/**
 * component
 */
export class PayPalButton extends React.Component<PayPalButtonProps, State> {
  constructor(props: PayPalButtonProps) {
    super(props)
    this.state = {
      loaded: false,
      error: false
    }
    this.onAuthorize = this.onAuthorize.bind(this);
    this.payment = this.payment.bind(this);
    this.onShippingChange = this.onShippingChange.bind(this);
    this.onCancel = this.onCancel.bind(this);
  }

  async componentDidMount() {
    const paypalLoaded = !!(window as any).__pptmLoadedWithNoContent
    if(paypalLoaded){
      this.setState({loaded: true})
    }
  }

  componentDidCatch() {
    this.setState({error: true})
  }

  payment(data, actions): void {
    if(this.props.onPaymentStart){
      this.props.onPaymentStart();
    }

    return actions.payment.create({
      transactions: [
        {
          amount: {
            total: this.props.amount,
            currency: this.props.currency,
          }
        }
      ]
    }).catch((e: any) => {
      console.error({message: 'Error Loading React Paypal Button, check your environment variables'})
      this.setState({error: true})
    })
  }

  onAuthorize(data, actions): void {
    return actions.payment.execute()
      .then((res: PayPalPaymentData) => {
        if (this.props.onPaymentSuccess) {
          this.props.onPaymentSuccess(res)
        }
      })
      .catch((e: any) => {
        if(this.props.onPaymentError){
          this.props.onPaymentError(e.message)
        } else {
          console.warn({paypalOnAuthError: e.message})
        }
      })
  }


  onShippingChange(data: OnShippingChangeData, actions): void {
    if(this.props.onShippingChange){
     Promise.resolve(this.props.onShippingChange(data))
      .then((rate) => {

        // early exit if user doesn't return a value
        if(!rate){
          return actions.resolve()
        }

        const baseOrderAmount = `${this.props.amount}`
        const shippingAmount = `${rate}`;
        const value = (parseFloat(baseOrderAmount) + parseFloat(shippingAmount)).toFixed(2);
        const currency_code = this.props.currency

        return actions.order.patch([
          {
            op: 'replace',
            path: '/purchase_units/@reference_id==\'default\'/amount',
            value: {
              currency_code,
              value,
              breakdown: {
                item_total: {
                  currency_code,
                  value: baseOrderAmount
                },
                shipping: {
                  currency_code,
                  value: shippingAmount
                }
              }
            }
          }
        ]);
      });
    } else {
      return actions.resolve()
    }
  }

  onCancel(data: OnCancelData){
    if(this.props.onPaymentCancel){
      this.props.onPaymentCancel(data)
    }
  }

  render() {
    const { error, loaded } = this.state;
    const { env, sandboxID, productionID,  amount } = this.props;
    if(error){
      return null
    }
    return loaded && !error && (
      <Button
        commit={true}
        env={env}
        amount={amount}
        client={{
          sandbox: sandboxID,
          production: productionID
        }}
        payment={this.payment}
        onAuthorize={this.onAuthorize}
        onShippingChange={this.onShippingChange}
        onCancel={this.onCancel}
      />
    );
  }
}