import cloudwatch = require('@aws-cdk/aws-cloudwatch');
import cdk = require('@aws-cdk/cdk');
import { cloudformation } from './applicationautoscaling.generated';
import { ScalableTarget } from './scalable-target';

/**
 * Properties for a scaling policy
 */
export interface StepScalingActionProps {
  /**
   * The scalable target
   */
  scalingTarget: ScalableTarget;

  /**
   * A name for the scaling policy
   *
   * @default Automatically generated name
   */
  policyName?: string;

  /**
   * How the adjustment numbers are interpreted
   *
   * @default ChangeInCapacity
   */
  adjustmentType?: AdjustmentType;

  /**
   * Grace period after scaling activity.
   *
   * For scale out policies, multiple scale outs during the cooldown period are
   * squashed so that only the biggest scale out happens.
   *
   * For scale in policies, subsequent scale ins during the cooldown period are
   * ignored.
   *
   * @see https://docs.aws.amazon.com/autoscaling/application/APIReference/API_StepScalingPolicyConfiguration.html
   * @default No cooldown period
   */
  cooldownSec?: number;

  /**
   * Minimum absolute number to adjust capacity with as result of percentage scaling.
   *
   * Only when using AdjustmentType = PercentChangeInCapacity, this number controls
   * the minimum absolute effect size.
   *
   * @default No minimum scaling effect
   */
  minAdjustmentMagnitude?: number;

  /**
   * The aggregation type for the CloudWatch metrics.
   *
   * @default Average
   */
  metricAggregationType?: MetricAggregationType;
}

/**
 * Define a step scaling action
 *
 * This kind of scaling policy adjusts the target capacity in configurable
 * steps. The size of the step is configurable based on the metric's distance
 * to its alarm threshold.
 *
 * This Action must be used as the target of a CloudWatch alarm to take effect.
 */
export class StepScalingAction extends cdk.Construct implements cloudwatch.IAlarmAction {
  /**
   * ARN of the scaling policy
   */
  public readonly scalingPolicyArn: string;

  /**
   * ARN when this scaling policy is used as an Alarm action
   */
  public readonly alarmActionArn: string;

  private readonly adjustments = new Array<cloudformation.ScalingPolicyResource.StepAdjustmentProperty>();

  constructor(parent: cdk.Construct, id: string, props: StepScalingActionProps) {
    super(parent, id);

    const resource = new cloudformation.ScalingPolicyResource(this, 'Resource', {
      policyName: props.policyName || this.uniqueId,
      policyType: 'StepScaling',
      stepScalingPolicyConfiguration: {
        adjustmentType: props.adjustmentType,
        cooldown: props.cooldownSec,
        minAdjustmentMagnitude: props.minAdjustmentMagnitude,
        metricAggregationType: props.metricAggregationType,
        stepAdjustments: new cdk.Token(() => this.adjustments),
      } as cloudformation.ScalingPolicyResource.StepScalingPolicyConfigurationProperty
    });

    this.scalingPolicyArn = resource.scalingPolicyArn;
    this.alarmActionArn = this.scalingPolicyArn;
  }

  /**
   * Add an adjusment interval to the ScalingAction
   */
  public addAdjustment(adjustment: AdjustmentTier) {
    if (adjustment.lowerBound === undefined && adjustment.upperBound === undefined) {
      throw new Error('At least one of lowerBound or upperBound is required');
    }
    this.adjustments.push({
      metricIntervalLowerBound: adjustment.lowerBound,
      metricIntervalUpperBound: adjustment.upperBound,
      scalingAdjustment: adjustment.adjustment,
    });
  }
}

/**
 * How adjustment numbers are interpreted
 */
export enum AdjustmentType {
  /**
   * Add the adjustment number to the current capacity.
   *
   * A positive number increases capacity, a negative number decreases capacity.
   */
  ChangeInCapacity = 'ChangeInCapacity',

  /**
   * Add this percentage of the current capacity to itself.
   *
   * The number must be between -100 and 100; a positive number increases
   * capacity and a negative number decreases it.
   */
  PercentChangeInCapacity = 'PercentChangeInCapacity',

  /**
   * Make the capacity equal to the exact number given.
   */
  ExactCapacity = 'ExactCapacity',
}

/**
 * How the scaling metric is going to be aggregated
 */
export enum MetricAggregationType {
  /**
   * Average
   */
  Average = 'Average',

  /**
   * Minimum
   */
  Minimum = 'Minimum',

  /**
   * Maximum
   */
  Maximum = 'Maximum'
}

/**
 * An adjustment
 */
export interface AdjustmentTier {
  /**
   * What number to adjust the capacity with
   *
   * The number is interpeted as an added capacity, a new fixed capacity or an
   * added percentage depending on the AdjustmentType value of the
   * StepScalingPolicy.
   *
   * Can be positive or negative.
   */
  adjustment: number;

  /**
   * Lower bound where this scaling tier applies.
   *
   * The scaling tier applies if the difference between the metric
   * value and its alarm threshold is higher than this value.
   *
   * @default -Infinity if this is the first tier, otherwise the upperBound of the previous tier
   */
  lowerBound?: number;

  /**
   * Upper bound where this scaling tier applies
   *
   * The scaling tier applies if the difference between the metric
   * value and its alarm threshold is lower than this value.
   *
   * @default +Infinity
   */
  upperBound?: number;
}